import re
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from threading import RLock
from typing import Any, Literal, Protocol, TypeAlias
from urllib.parse import urlparse

from services.hotwords import HotwordRuntimeConfig

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderDebug,
    ProviderError,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    UsageUpdated,
)


SUPPORTED_MODELS = (
    'fun-asr-realtime',
    'fun-asr-realtime-2025-11-07',
)

_PERMANENT_ERROR_MARKERS = (
    'invalidapikey',
    'notauthorized',
    'unauthorized',
    'accessdenied',
    'forbidden',
    'permissiondenied',
    'authenticationfailed',
    'invalidtoken',
    'unpurchased',
    'invalidparameter',
    'modelnotexist',
    'modelnotfound',
    'modelunavailable',
    'modelnotavailable',
    'unsupportedmodel',
    'invalidmodel',
    'modeldisabled',
    'arrearage',
    'billoverdue',
    'commoditynotpurchased',
)
_RETRYABLE_ERROR_MARKERS = (
    'throttl',
    'ratelimit',
    'resourceexhausted',
    'internalerror',
    'systemerror',
    'timeout',
    'unavailable',
    'connection',
    'network',
    'websocket',
)


def _safe_diagnostic_text(
    value: object,
    secrets: tuple[str, ...] = (),
) -> str:
    text = value if isinstance(value, str) else ''
    for secret in secrets:
        if secret:
            text = text.replace(secret, '<redacted>')
    text = re.sub(
        r'\bsk-(?:sp-)?[A-Za-z0-9_-]{8,}\b',
        '<redacted>',
        text,
    )
    text = re.sub(
        r'\bBearer\s+[^\s"\']+',
        'Bearer <redacted>',
        text,
        flags=re.IGNORECASE,
    )
    return text[:1000]


def _safe_identifier(value: object) -> str:
    if not isinstance(value, str):
        return ''
    return value[:256] if re.fullmatch(r'[A-Za-z0-9_-]+', value) else ''


def _is_retryable_failure(status_code: int | None, code: str) -> bool:
    normalized = re.sub(r'[^a-z0-9]', '', code.lower())
    if any(marker in normalized for marker in _PERMANENT_ERROR_MARKERS):
        return False
    if status_code in (400, 401, 403, 404):
        return False
    if status_code in (408, 425, 429) or (
        status_code is not None and 500 <= status_code <= 599
    ):
        return True
    if any(marker in normalized for marker in _RETRYABLE_ERROR_MARKERS):
        return True
    # Unknown transport/SDK failures remain bounded by max_reconnects.
    return True


@dataclass(frozen=True)
class FunAsrClientOptions:
    model: str
    websocket_url: str
    workspace_id: str
    api_key: str = field(repr=False)
    source_language: str = 'auto'
    semantic_punctuation_enabled: bool = False
    max_sentence_silence_ms: int = 1300
    heartbeat_enabled: bool = True
    vocabulary_id: str = ''


class FunAsrClient(Protocol):
    def start(self, **kwargs) -> None: ...
    def send_audio_frame(self, data: bytes) -> None: ...
    def stop(self) -> None: ...
    def can_stop(self) -> bool: ...
    def abort_failed(self) -> None: ...


class FunAsrResult(Protocol):
    status_code: int | None
    code: str | None
    message: str | None
    request_id: str | None
    def get_sentence(self) -> dict[str, Any]: ...
    def get_usage(self, sentence: dict[str, Any]) -> dict[str, Any] | None: ...
    @staticmethod
    def is_sentence_end(sentence: dict[str, Any]) -> bool: ...


class FunAsrCallback:
    def __init__(self, provider: 'FunAsrProvider', generation: int) -> None:
        self._provider = provider
        self._generation = generation

    def on_open(self) -> None:
        self._provider.handle_open(self._generation)

    def on_complete(self) -> None:
        self._provider.handle_complete(self._generation)

    def on_error(self, result: FunAsrResult) -> None:
        self._provider.handle_error(self._generation, result)

    def on_close(self) -> None:
        self._provider.handle_close(self._generation)

    def on_event(self, result: FunAsrResult) -> None:
        self._provider.handle_event(self._generation, result)


FunAsrClientFactory = Callable[
    [FunAsrClientOptions, FunAsrCallback],
    FunAsrClient,
]


class _DashScopeRecognitionClient:
    """Contain the SDK 1.26.x failed-task cleanup quirk."""

    def __init__(self, recognition: Any) -> None:
        self._recognition = recognition

    def start(self, **kwargs) -> None:
        self._recognition.start(**kwargs)

    def send_audio_frame(self, data: bytes) -> None:
        self._recognition.send_audio_frame(data)

    def stop(self) -> None:
        self._recognition.stop()

    def can_stop(self) -> bool:
        return bool(getattr(self._recognition, '_running', True))

    def abort_failed(self) -> None:
        # DashScope 1.26.7 marks the task stopped before on_error but
        # leaves its non-daemon 23-second silence timer alive.
        timer = getattr(self._recognition, '_silence_timer', None)
        if timer is not None:
            timer.cancel()
            setattr(self._recognition, '_silence_timer', None)


def _build_client(
    options: FunAsrClientOptions,
    callback: FunAsrCallback,
) -> FunAsrClient:
    import dashscope
    from dashscope.audio.asr import Recognition, RecognitionCallback

    if options.api_key:
        dashscope.api_key = options.api_key
    dashscope.base_websocket_api_url = options.websocket_url

    class CallbackAdapter(RecognitionCallback):
        def on_open(self) -> None:
            callback.on_open()

        def on_complete(self) -> None:
            callback.on_complete()

        def on_error(self, result) -> None:
            callback.on_error(result)

        def on_close(self) -> None:
            callback.on_close()

        def on_event(self, result) -> None:
            callback.on_event(result)

    parameters: dict[str, Any] = {
        'semantic_punctuation_enabled': (
            options.semantic_punctuation_enabled
        ),
        'max_sentence_silence': options.max_sentence_silence_ms,
        'heartbeat': options.heartbeat_enabled,
    }
    if options.source_language != 'auto':
        parameters['language_hints'] = [options.source_language]
    if options.vocabulary_id:
        parameters['vocabulary_id'] = options.vocabulary_id

    recognition = Recognition(
        model=options.model,
        format='pcm',
        sample_rate=16000,
        workspace=options.workspace_id,
        callback=CallbackAdapter(),
        **parameters,
    )

    return _DashScopeRecognitionClient(recognition)


@dataclass(frozen=True)
class FunAsrFailure:
    status_code: int | None
    code: str
    message: str
    request_id: str
    retryable: bool

    def details(self, generation: int) -> dict[str, object]:
        details: dict[str, object] = {
            'provider': 'fun_asr',
            'generation': generation,
            'retryable': self.retryable,
        }
        if self.status_code is not None:
            details['statusCode'] = self.status_code
        if self.code:
            details['code'] = self.code
        if self.message:
            details['serviceMessage'] = self.message
        if self.request_id:
            details['requestId'] = self.request_id
        return details


GenerationState: TypeAlias = Literal[
    'connecting',
    'active',
    'failed',
    'closing',
    'closed',
]


def validate_fun_asr_options(options: FunAsrClientOptions) -> None:
    if options.model not in SUPPORTED_MODELS:
        raise ValueError('Unsupported Fun-ASR model')
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', options.workspace_id):
        raise ValueError('Invalid Fun-ASR Workspace ID')
    if not 200 <= options.max_sentence_silence_ms <= 6000:
        raise ValueError('Invalid Fun-ASR sentence silence')

    endpoint = urlparse(options.websocket_url)
    expected_hosts = {
        f'{options.workspace_id}.cn-beijing.maas.aliyuncs.com'.lower(),
        f'{options.workspace_id}.ap-southeast-1.maas.aliyuncs.com'.lower(),
    }
    if (
        endpoint.scheme != 'wss'
        or (endpoint.hostname or '').lower() not in expected_hosts
        or endpoint.path != '/api-ws/v1/inference'
        or endpoint.params
        or endpoint.query
        or endpoint.fragment
    ):
        raise ValueError('Invalid Fun-ASR endpoint/workspace combination')


class FunAsrProvider(RecognitionProvider):
    """DashScope SDK adapter for Fun-ASR Realtime WebSocket tasks."""

    def __init__(
        self,
        options: FunAsrClientOptions,
        client_factory: FunAsrClientFactory = _build_client,
        sleeper: Callable[[float], None] = time.sleep,
        clock: Callable[[], datetime] = datetime.now,
        max_reconnects: int = 3,
        reconnect_backoff_seconds: float = 0.25,
        max_buffered_frames: int = 50,
        hotwords: HotwordRuntimeConfig = HotwordRuntimeConfig(),
    ) -> None:
        super().__init__()
        validate_fun_asr_options(options)
        if max_reconnects < 0:
            raise ValueError('max_reconnects cannot be negative')
        if reconnect_backoff_seconds < 0:
            raise ValueError('reconnect backoff cannot be negative')
        if max_buffered_frames <= 0:
            raise ValueError('max_buffered_frames must be positive')
        self._options = replace(
            options,
            **hotwords.recognition_client_options(options.model),
        )
        self._hotword_start_options = hotwords.recognition_start_options(
            options.model
        )
        self._client_factory = client_factory
        self._sleeper = sleeper
        self._clock = clock
        self._max_reconnects = max_reconnects
        self._reconnect_backoff_seconds = reconnect_backoff_seconds
        self._pending_audio: deque[bytes] = deque(maxlen=max_buffered_frames)
        self._lock = RLock()
        self._client: FunAsrClient | None = None
        self._generation = 0
        self._reconnects = 0
        self._ready = False
        self._stopping = False
        self._stopped_emitted = False
        self._generation_states: dict[int, GenerationState] = {}
        self._fatal_emitted = False
        self._finalized_caption_ids: set[int] = set()
        self._task_started_at = self._clock()
        self._latest_audio_offset_ms = 0
        self._last_usage: int | float | None = None

    @property
    def name(self) -> str:
        return 'fun_asr'

    def start(self) -> None:
        self._stopping = False
        self._stopped_emitted = False
        self._generation_states.clear()
        self._fatal_emitted = False
        self._reconnects = 0
        try:
            self._connect_once()
            self._flush_pending_audio()
        except Exception as error:
            self._handle_failure(
                self._generation,
                self._failure_from_exception(error),
            )

    def accept_audio(self, frame: AudioFrame) -> None:
        if frame.format != 'pcm_s16le':
            raise ValueError('Fun-ASR requires pcm_s16le audio')
        if frame.sample_rate != 16000:
            raise ValueError('Fun-ASR requires 16000 Hz audio')
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('Fun-ASR requires mono PCM16 audio')

        with self._lock:
            client = self._client if self._ready else None
            generation = self._generation
            if client is None:
                self._buffer_audio(frame.data)
                return
        try:
            client.send_audio_frame(frame.data)
            self._track_sent_audio(frame.data)
        except Exception as error:
            with self._lock:
                self._buffer_audio(frame.data)
            self._handle_failure(
                generation,
                self._failure_from_exception(error),
            )

    def stop(self) -> None:
        with self._lock:
            if self._stopping:
                return
            self._stopping = True
            self._ready = False
            client = self._client
            self._client = None
            if client is not None:
                self._generation_states[self._generation] = 'closing'
        if client is not None and self._client_can_stop(client):
            try:
                # SDK stop sends finish-task and blocks for task-finished/error.
                client.stop()
            except Exception as error:
                if type(error).__name__ == 'InvalidParameter':
                    self._emit(ProviderDebug(
                        provider=self.name,
                        message='Ignored stop for an SDK-stopped task.',
                        details={'generation': self._generation},
                    ))
                else:
                    self._emit(ProviderError(
                        provider=self.name,
                        message=(
                            'Fun-ASR stop failed '
                            f'({type(error).__name__})'
                        ),
                        fatal=False,
                    ))
        elif client is not None:
            self._emit(ProviderDebug(
                provider=self.name,
                message='Skipped stop for an inactive Fun-ASR task.',
                details={'generation': self._generation},
            ))
        self._emit_stopped()

    def handle_open(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation or self._stopping:
                return
            self._ready = True
            self._generation_states[generation] = 'active'
        self._emit(ProviderReady(
            provider=self.name,
            message='Fun-ASR realtime task started.',
        ))
        self._emit(ProviderDebug(
            provider=self.name,
            message='Fun-ASR client connection opened.',
            details={'generation': generation},
        ))

    def handle_complete(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation:
                return
            self._ready = False
            self._generation_states[generation] = 'closed'
        self._emit_stopped()

    def handle_close(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation:
                return
            self._ready = False
            stopping = self._stopping
            state = self._generation_states.get(generation)
            already_failed = state == 'failed'
            if stopping:
                self._generation_states[generation] = 'closed'
        if stopping:
            self._emit_stopped()
        elif already_failed:
            self._emit(ProviderDebug(
                provider=self.name,
                message='Ignored close after generation failure.',
                details={'generation': generation},
            ))
        else:
            self._handle_failure(generation, FunAsrFailure(
                status_code=None,
                code='ConnectionClosed',
                message='Fun-ASR connection closed unexpectedly.',
                request_id='',
                retryable=True,
            ))

    def handle_error(
        self,
        generation: int,
        result: FunAsrResult,
    ) -> None:
        self._handle_failure(generation, self._failure_from_result(result))

    def handle_event(
        self,
        generation: int,
        result: FunAsrResult,
    ) -> None:
        with self._lock:
            if generation != self._generation or self._stopping:
                return
            self._reconnects = 0
        sentence = result.get_sentence()
        if not isinstance(sentence, dict):
            raise ValueError('Fun-ASR sentence must be an object')
        if sentence.get('heartbeat') is True:
            return
        text = sentence.get('text')
        if not isinstance(text, str) or not text:
            return
        sentence_id = sentence.get('sentence_id')
        if not isinstance(sentence_id, int) or sentence_id <= 0:
            raise ValueError('Fun-ASR sentence_id must be positive')

        caption_id = generation * 1_000_000 + sentence_id
        begin_offset = sentence.get('begin_time')
        if not isinstance(begin_offset, (int, float)):
            begin_offset = 0
        begin_time = self._timestamp_offset(begin_offset, 0)
        end_time = self._timestamp_offset(
            sentence.get('end_time'),
            max(self._latest_audio_offset_ms, round(begin_offset)),
        )
        is_final = bool(sentence.get('sentence_end')) or bool(
            result.is_sentence_end(sentence)
        )
        if is_final:
            if caption_id in self._finalized_caption_ids:
                return
            self._finalized_caption_ids.add(caption_id)
            self._emit(CaptionFinal(
                caption_id=caption_id,
                started_at=begin_time,
                ended_at=end_time,
                text=text,
            ))
            self._emit_usage(result.get_usage(sentence))
        elif caption_id not in self._finalized_caption_ids:
            self._emit(CaptionPartial(
                caption_id=caption_id,
                started_at=begin_time,
                ended_at=end_time,
                text=text,
            ))

    def _connect_once(self) -> None:
        with self._lock:
            self._generation += 1
            generation = self._generation
            self._generation_states[generation] = 'connecting'
            self._task_started_at = self._clock()
            self._latest_audio_offset_ms = 0
        callback = FunAsrCallback(self, generation)
        client = self._client_factory(self._options, callback)
        with self._lock:
            if self._stopping:
                return
            self._client = client
        client.start(**self._hotword_start_options)

    def _handle_failure(
        self,
        generation: int,
        failure: FunAsrFailure,
    ) -> None:
        with self._lock:
            if (
                generation != self._generation
                or self._stopping
                or self._generation_states.get(generation) in (
                    'failed',
                    'closed',
                )
            ):
                return
            self._generation_states[generation] = 'failed'
            self._ready = False
            client = self._client
            self._client = None

        if client is not None:
            try:
                self._abort_failed_client(client)
            except Exception as error:
                self._emit(ProviderDebug(
                    provider=self.name,
                    message='Fun-ASR failed-client cleanup failed.',
                    details={
                        'generation': generation,
                        'errorType': type(error).__name__,
                    },
                ))
        self._emit(ProviderDebug(
            provider=self.name,
            message='Fun-ASR generation failed.',
            details=failure.details(generation),
        ))
        if not failure.retryable:
            self._emit_fatal(failure, generation, exhausted=False)
            return
        self._reconnect(generation, failure)

    def _reconnect(
        self,
        failed_generation: int,
        failure: FunAsrFailure,
    ) -> None:
        with self._lock:
            if failed_generation != self._generation or self._stopping:
                return
            if self._reconnects >= self._max_reconnects:
                attempt = None
            else:
                self._reconnects += 1
                attempt = self._reconnects
        if attempt is None:
            self._emit_fatal(failure, failed_generation, exhausted=True)
            return
        self._emit(ProviderInfo(
            provider=self.name,
            message=(
                'Fun-ASR reconnect attempt '
                f'{attempt}/{self._max_reconnects}.'
            ),
        ))
        self._sleeper(
            self._reconnect_backoff_seconds * (2 ** (attempt - 1))
        )
        try:
            self._connect_once()
            self._flush_pending_audio()
        except Exception as error:
            self._handle_failure(
                self._generation,
                self._failure_from_exception(error),
            )

    def _emit_fatal(
        self,
        failure: FunAsrFailure,
        generation: int,
        exhausted: bool,
    ) -> None:
        with self._lock:
            if self._fatal_emitted:
                return
            self._fatal_emitted = True
        if exhausted:
            message = 'Fun-ASR reconnect attempts exhausted.'
        elif failure.code:
            message = f'Fun-ASR task failed ({failure.code}).'
        else:
            message = 'Fun-ASR task failed.'
        self._emit(ProviderError(
            provider=self.name,
            message=message,
            fatal=True,
            details=failure.details(generation),
        ))

    @staticmethod
    def _client_can_stop(client: FunAsrClient) -> bool:
        can_stop = getattr(client, 'can_stop', None)
        return bool(can_stop()) if callable(can_stop) else True

    @staticmethod
    def _abort_failed_client(client: FunAsrClient) -> None:
        abort_failed = getattr(client, 'abort_failed', None)
        if callable(abort_failed):
            abort_failed()

    def _failure_from_result(self, result: FunAsrResult) -> FunAsrFailure:
        status = getattr(result, 'status_code', None)
        status_code = int(status) if isinstance(status, int) else None
        secrets = (self._options.api_key,)
        code = _safe_diagnostic_text(getattr(result, 'code', ''), secrets)
        message = _safe_diagnostic_text(
            getattr(result, 'message', ''),
            secrets,
        )
        request_id = _safe_identifier(getattr(result, 'request_id', ''))
        return FunAsrFailure(
            status_code=status_code,
            code=code,
            message=message,
            request_id=request_id,
            retryable=_is_retryable_failure(status_code, code),
        )

    def _failure_from_exception(self, error: Exception) -> FunAsrFailure:
        code = type(error).__name__
        return FunAsrFailure(
            status_code=None,
            code=code,
            message=_safe_diagnostic_text(
                str(error),
                (self._options.api_key,),
            ),
            request_id='',
            retryable=_is_retryable_failure(None, code),
        )

    def _buffer_audio(self, data: bytes) -> None:
        was_full = len(self._pending_audio) == self._pending_audio.maxlen
        self._pending_audio.append(data)
        if was_full:
            self._emit(ProviderInfo(
                provider=self.name,
                message='Fun-ASR reconnect audio buffer dropped one frame.',
            ))

    def _flush_pending_audio(self) -> None:
        while self._pending_audio and not self._stopping:
            with self._lock:
                client = self._client if self._ready else None
            if client is None:
                return
            data = self._pending_audio.popleft()
            client.send_audio_frame(data)
            self._track_sent_audio(data)

    def _track_sent_audio(self, data: bytes) -> None:
        # 16 kHz mono PCM16 carries 32 bytes per millisecond.
        with self._lock:
            self._latest_audio_offset_ms += round(len(data) / 32)

    def _timestamp_offset(self, value: Any, fallback_ms: int) -> str:
        offset_ms = value if isinstance(value, (int, float)) else fallback_ms
        timestamp = self._task_started_at + timedelta(
            milliseconds=max(0, offset_ms)
        )
        return timestamp.strftime('%H:%M:%S.%f')[:-3]

    def _emit_usage(self, usage: dict[str, Any] | None) -> None:
        if not usage:
            return
        duration = usage.get('duration')
        if (
            not isinstance(duration, (int, float))
            or duration == self._last_usage
        ):
            return
        self._last_usage = duration
        self._emit(UsageUpdated(
            provider=self.name,
            value=duration,
            unit='seconds',
        ))

    def _emit_stopped(self) -> None:
        with self._lock:
            if self._stopped_emitted:
                return
            self._stopped_emitted = True
        self._emit(ProviderStopped(
            provider=self.name,
            message='Fun-ASR realtime task finished.',
        ))
