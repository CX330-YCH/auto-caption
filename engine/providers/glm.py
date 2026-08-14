import audioop
import io
import wave
from collections.abc import Callable
from datetime import datetime
from urllib.parse import urlparse

from core import (
    AudioFrame,
    CaptionFinal,
    ProviderError,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    exception_diagnostic,
)
from core.worker import BoundedWorkerPool


GlmRequest = Callable[[bytes], str]


def _current_time() -> str:
    return datetime.now().strftime('%H:%M:%S.%f')[:-3]


def _build_request(url: str, model: str, api_key: str) -> GlmRequest:
    def request(audio_content: bytes) -> str:
        import requests

        response = requests.post(
            url,
            headers={'Authorization': f'Bearer {api_key}'},
            data={'model': model, 'stream': 'false'},
            files={'file': ('audio.wav', audio_content, 'audio/wav')},
            timeout=15,
        )
        response.raise_for_status()
        text = response.json().get('text', '')
        if not isinstance(text, str):
            raise ValueError('GLM response text must be a string')
        return text

    return request


class GlmProvider(RecognitionProvider):
    def __init__(
        self,
        url: str,
        model: str,
        api_key: str,
        request_factory: Callable[[str, str, str], GlmRequest] = (
            _build_request
        ),
        rms_calculator: Callable[[bytes, int], int] = audioop.rms,
        clock: Callable[[], str] = _current_time,
        worker_count: int = 2,
        max_pending_requests: int = 8,
        shutdown_timeout: float = 1.0,
    ) -> None:
        super().__init__()
        self._url = url
        self._model = model
        self._api_key = api_key
        self._request_factory = request_factory
        self._rms_calculator = rms_calculator
        self._clock = clock
        self._worker_count = worker_count
        self._max_pending_requests = max_pending_requests
        self._shutdown_timeout = shutdown_timeout
        self._request: GlmRequest | None = None
        self._workers: BoundedWorkerPool | None = None
        self._audio_buffer: list[bytes] = []
        self._is_speech = False
        self._silence_frames = 0
        self._started_at = ''
        self._caption_id = 0
        self._accept_results = False
        self._started = False
        self._threshold = 500
        self._silence_limit = 15
        self._min_speech_frames = 10

    @property
    def name(self) -> str:
        return 'glm'

    def start(self) -> None:
        parsed_url = urlparse(self._url)
        if parsed_url.scheme not in {'http', 'https'} or not parsed_url.netloc:
            raise ValueError('GLM URL must use http or https')
        try:
            self._request = self._request_factory(
                self._url,
                self._model,
                self._api_key,
            )
        except Exception as error:
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    'GLM-ASR client initialization failed '
                    f'({type(error).__name__})'
                ),
                fatal=True,
                details=exception_diagnostic(
                    error,
                    operation='glm.client.initialize',
                    secrets=(self._api_key,),
                ),
            ))
            return
        self._workers = BoundedWorkerPool(
            self._worker_count,
            self._max_pending_requests,
        )
        self._accept_results = True
        self._started = True
        self._emit(ProviderReady(
            provider=self.name,
            message='GLM-ASR recognizer started.',
        ))

    def accept_audio(self, frame: AudioFrame) -> None:
        if not self._started:
            raise RuntimeError('GLM provider is not started')
        self._validate_frame(frame)
        rms = self._rms_calculator(frame.data, frame.sample_width)
        if rms > self._threshold:
            if not self._is_speech:
                self._is_speech = True
                self._started_at = self._clock()
                self._audio_buffer = []
            self._audio_buffer.append(frame.data)
            self._silence_frames = 0
            return
        if not self._is_speech:
            return

        self._audio_buffer.append(frame.data)
        self._silence_frames += 1
        if self._silence_frames <= self._silence_limit:
            return
        if len(self._audio_buffer) > self._min_speech_frames:
            self._submit_segment(
                self._audio_buffer,
                self._started_at,
                self._caption_id,
            )
            self._caption_id += 1
        self._is_speech = False
        self._audio_buffer = []
        self._silence_frames = 0

    def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        completed = True
        if self._workers is not None:
            completed = self._workers.close(
                cancel_pending=True,
                wait_timeout=self._shutdown_timeout,
            )
        self._accept_results = False
        if not completed:
            self._emit(ProviderInfo(
                provider=self.name,
                message='GLM-ASR pending request did not finish before stop.',
            ))
        self._emit(ProviderStopped(
            provider=self.name,
            message='GLM-ASR recognizer stopped.',
        ))

    def _validate_frame(self, frame: AudioFrame) -> None:
        if frame.format != 'pcm_s16le':
            raise ValueError('GLM requires pcm_s16le audio')
        if frame.sample_rate != 16000:
            raise ValueError('GLM requires 16000 Hz audio')
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('GLM requires mono PCM16 audio')

    def _submit_segment(
        self,
        audio_frames: list[bytes],
        started_at: str,
        caption_id: int,
    ) -> None:
        if self._workers is None:
            raise RuntimeError('GLM worker pool is not started')
        audio_content = self._build_wav(audio_frames)
        submitted = self._workers.submit(
            lambda: self._recognize(audio_content, started_at, caption_id)
        )
        if not submitted:
            self._emit(ProviderError(
                provider=self.name,
                message='GLM-ASR request queue is full; segment was skipped.',
                fatal=False,
            ))

    def _recognize(
        self,
        audio_content: bytes,
        started_at: str,
        caption_id: int,
    ) -> None:
        try:
            if self._request is None:
                raise RuntimeError('GLM request client is not initialized')
            text = self._request(audio_content)
            if text and self._accept_results:
                self._emit(CaptionFinal(
                    caption_id=caption_id,
                    started_at=started_at,
                    ended_at=self._clock(),
                    text=text,
                ))
        except Exception as error:
            if self._accept_results:
                self._emit(ProviderError(
                    provider=self.name,
                    message=f'GLM-ASR request failed ({type(error).__name__})',
                    fatal=False,
                    details=exception_diagnostic(
                        error,
                        operation='glm.request',
                        secrets=(self._api_key,),
                    ),
                ))

    @staticmethod
    def _build_wav(audio_frames: list[bytes]) -> bytes:
        wav_output = io.BytesIO()
        with wave.open(wav_output, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(b''.join(audio_frames))
        return wav_output.getvalue()
