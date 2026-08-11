import json
from collections.abc import Callable
from datetime import datetime
from typing import Any

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
)


RecognizerFactory = Callable[[str, int], Any]


def _current_time() -> str:
    return datetime.now().strftime('%H:%M:%S.%f')[:-3]


def _default_recognizer_factory(model_path: str, sample_rate: int):
    from vosk import KaldiRecognizer, Model, SetLogLevel

    SetLogLevel(-1)
    return KaldiRecognizer(Model(model_path), sample_rate)


class VoskProvider(RecognitionProvider):
    def __init__(
        self,
        model_path: str,
        recognizer_factory: RecognizerFactory = _default_recognizer_factory,
        clock: Callable[[], str] = _current_time,
    ) -> None:
        super().__init__()
        self._model_path = model_path.strip('"')
        self._recognizer_factory = recognizer_factory
        self._clock = clock
        self._recognizer = None
        self._sample_rate = 16000
        self._caption_id = 0
        self._started_at = ''
        self._previous_partial = ''
        self._started = False

    @property
    def name(self) -> str:
        return 'vosk'

    def start(self) -> None:
        self._recognizer = self._recognizer_factory(
            self._model_path,
            self._sample_rate,
        )
        self._started = True
        self._emit(ProviderReady(
            provider=self.name,
            message='Vosk recognizer started.',
        ))

    def accept_audio(self, frame: AudioFrame) -> None:
        if not self._started or self._recognizer is None:
            raise RuntimeError('Vosk provider is not started')
        if frame.format != 'pcm_s16le':
            raise ValueError('Vosk requires pcm_s16le audio')
        if frame.sample_rate != self._sample_rate:
            raise ValueError('Vosk requires 16000 Hz audio')
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('Vosk requires mono PCM16 audio')

        if self._recognizer.AcceptWaveform(frame.data):
            self._emit_final_result(self._recognizer.Result())
        else:
            self._emit_partial_result(self._recognizer.PartialResult())

    def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        self._emit(ProviderStopped(
            provider=self.name,
            message='Vosk recognizer closed.',
        ))

    def _emit_partial_result(self, result: str) -> None:
        text = json.loads(result).get('partial', '')
        if not isinstance(text, str):
            raise ValueError('Vosk partial result must be a string')
        if not text or text == self._previous_partial:
            return
        if not self._previous_partial:
            self._started_at = self._clock()
        self._previous_partial = text
        self._emit(CaptionPartial(
            caption_id=self._caption_id,
            started_at=self._started_at,
            ended_at=self._clock(),
            text=text,
        ))

    def _emit_final_result(self, result: str) -> None:
        text = json.loads(result).get('text', '')
        if not isinstance(text, str):
            raise ValueError('Vosk final result must be a string')
        self._previous_partial = ''
        if not text:
            return
        self._emit(CaptionFinal(
            caption_id=self._caption_id,
            started_at=self._started_at,
            ended_at=self._clock(),
            text=text,
        ))
        self._caption_id += 1
