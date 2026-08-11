"""Sherpa-ONNX SenseVoice provider.

The backend algorithm is based on:
https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/simulate-streaming-sense-voice-microphone.py
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
)


@dataclass(frozen=True)
class SosvRecognition:
    text: str
    final: bool


class SosvBackend(Protocol):
    def start(self) -> None: ...
    def accept_audio(self, data: bytes) -> list[SosvRecognition]: ...
    def stop(self) -> None: ...


def _current_time() -> str:
    return datetime.now().strftime('%H:%M:%S.%f')[:-3]


class SherpaSosvBackend:
    def __init__(
        self,
        model_path: str,
        source: str,
        wall_clock: Callable[[], float] = time.time,
    ) -> None:
        self._model_path = model_path
        self._source = source
        self._wall_clock = wall_clock

    def start(self) -> None:
        import numpy as np
        import sherpa_onnx

        extension = '.int8' if self._model_path.endswith('int8') else ''
        self._np = np
        self._recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=(
                f'{self._model_path}/sensevoice/model{extension}.onnx'
            ),
            tokens=f'{self._model_path}/sensevoice/tokens.txt',
            language=self._source,
            num_threads=2,
        )

        vad_config = sherpa_onnx.VadModelConfig()
        vad_config.silero_vad.model = (
            f'{self._model_path}/silero_vad.onnx'
        )
        vad_config.silero_vad.threshold = 0.5
        vad_config.silero_vad.min_silence_duration = 0.1
        vad_config.silero_vad.min_speech_duration = 0.25
        vad_config.silero_vad.max_speech_duration = 5
        vad_config.sample_rate = 16000
        self._window_size = vad_config.silero_vad.window_size
        self._vad = sherpa_onnx.VoiceActivityDetector(
            vad_config,
            buffer_size_in_seconds=100,
        )

        if self._source == 'en':
            model_config = sherpa_onnx.OnlinePunctuationModelConfig(
                cnn_bilstm=(
                    f'{self._model_path}/punct-en/model{extension}.onnx'
                ),
                bpe_vocab=f'{self._model_path}/punct-en/bpe.vocab',
            )
            punctuation_config = sherpa_onnx.OnlinePunctuationConfig(
                model_config=model_config,
            )
            self._punctuation = sherpa_onnx.OnlinePunctuation(
                punctuation_config
            )
        else:
            punctuation_config = sherpa_onnx.OfflinePunctuationConfig(
                model=sherpa_onnx.OfflinePunctuationModelConfig(
                    ct_transformer=(
                        f'{self._model_path}/punct/model{extension}.onnx'
                    )
                ),
            )
            self._punctuation = sherpa_onnx.OfflinePunctuation(
                punctuation_config
            )
        self._buffer = np.array([], dtype=np.float32)
        self._offset = 0
        self._speech_started = False
        self._speech_started_at = 0.0

    def accept_audio(self, data: bytes) -> list[SosvRecognition]:
        samples = self._np.frombuffer(data, dtype=self._np.int16).astype(
            self._np.float32
        )
        self._buffer = self._np.concatenate([self._buffer, samples])
        self._feed_vad_windows()
        results: list[SosvRecognition] = []

        if not self._speech_started:
            self._trim_idle_buffer()
        elif self._wall_clock() - self._speech_started_at > 0.2:
            text = self._decode(self._buffer)
            if text:
                results.append(SosvRecognition(text=text, final=False))
            self._speech_started_at = self._wall_clock()

        while not self._vad.empty():
            samples = self._vad.front.samples
            self._vad.pop()
            text = self._decode(samples)
            if text:
                results.append(SosvRecognition(
                    text=self._add_punctuation(text),
                    final=True,
                ))
            self._reset_segment()
        return results

    def stop(self) -> None:
        return

    def _feed_vad_windows(self) -> None:
        while self._offset + self._window_size < len(self._buffer):
            end = self._offset + self._window_size
            self._vad.accept_waveform(self._buffer[self._offset:end])
            if not self._speech_started and self._vad.is_speech_detected():
                self._speech_started = True
                self._speech_started_at = self._wall_clock()
            self._offset = end

    def _trim_idle_buffer(self) -> None:
        retained_samples = 10 * self._window_size
        if len(self._buffer) <= retained_samples:
            return
        removed_samples = len(self._buffer) - retained_samples
        self._offset -= removed_samples
        self._buffer = self._buffer[-retained_samples:]

    def _decode(self, samples) -> str:
        stream = self._recognizer.create_stream()
        stream.accept_waveform(16000, samples)
        self._recognizer.decode_stream(stream)
        return stream.result.text.strip()

    def _add_punctuation(self, text: str) -> str:
        if self._source == 'en':
            return self._punctuation.add_punctuation_with_case(text)
        return self._punctuation.add_punctuation(text)

    def _reset_segment(self) -> None:
        self._buffer = self._np.array([], dtype=self._np.float32)
        self._offset = 0
        self._speech_started = False
        self._speech_started_at = 0.0


class SosvProvider(RecognitionProvider):
    def __init__(
        self,
        model_path: str,
        source: str,
        backend_factory: Callable[[str, str], SosvBackend] = (
            SherpaSosvBackend
        ),
        clock: Callable[[], str] = _current_time,
    ) -> None:
        super().__init__()
        self._model_path = model_path.strip('"')
        self._source = source
        self._backend_factory = backend_factory
        self._clock = clock
        self._backend: SosvBackend | None = None
        self._caption_id = 0
        self._started_at = ''
        self._previous_partial = ''
        self._started = False

    @property
    def name(self) -> str:
        return 'sosv'

    def start(self) -> None:
        self._backend = self._backend_factory(
            self._model_path,
            self._source,
        )
        self._backend.start()
        self._started_at = self._clock()
        self._started = True
        self._emit(ProviderReady(
            provider=self.name,
            message='Shepra ONNX Sense Voice recognizer started.',
        ))

    def accept_audio(self, frame: AudioFrame) -> None:
        if not self._started or self._backend is None:
            raise RuntimeError('SOSV provider is not started')
        if frame.format != 'pcm_s16le':
            raise ValueError('SOSV requires pcm_s16le audio')
        if frame.sample_rate != 16000:
            raise ValueError('SOSV requires 16000 Hz audio')
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('SOSV requires mono PCM16 audio')

        for result in self._backend.accept_audio(frame.data):
            if result.final:
                self._publish_final(result.text)
            else:
                self._publish_partial(result.text)

    def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        if self._backend is not None:
            self._backend.stop()
        self._emit(ProviderStopped(
            provider=self.name,
            message='Shepra ONNX Sense Voice recognizer closed.',
        ))

    def _publish_partial(self, text: str) -> None:
        if not text or text == self._previous_partial:
            return
        self._previous_partial = text
        self._emit(CaptionPartial(
            caption_id=self._caption_id,
            started_at=self._started_at,
            ended_at=self._clock(),
            text=text,
        ))

    def _publish_final(self, text: str) -> None:
        if text:
            self._emit(CaptionFinal(
                caption_id=self._caption_id,
                started_at=self._started_at,
                ended_at=self._clock(),
                text=text,
            ))
            self._caption_id += 1
        self._previous_partial = ''
        self._started_at = self._clock()
