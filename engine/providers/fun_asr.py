import re
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import RLock
from typing import Any, Protocol
from urllib.parse import urlparse

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
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


class FunAsrClient(Protocol):
    def start(self) -> None: ...
    def send_audio_frame(self, data: bytes) -> None: ...
    def stop(self) -> None: ...


class FunAsrResult(Protocol):
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
        self._provider.handle_error(self._generation)

    def on_close(self) -> None:
        self._provider.handle_close(self._generation)

    def on_event(self, result: FunAsrResult) -> None:
        self._provider.handle_event(self._generation, result)


FunAsrClientFactory = Callable[
    [FunAsrClientOptions, FunAsrCallback],
    FunAsrClient,
]


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

    return Recognition(
        model=options.model,
        format='pcm',
        sample_rate=16000,
        workspace=options.workspace_id,
        callback=CallbackAdapter(),
        **parameters,
    )


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
    ) -> None:
        super().__init__()
        validate_fun_asr_options(options)
        if max_reconnects < 0:
            raise ValueError('max_reconnects cannot be negative')
        if reconnect_backoff_seconds < 0:
            raise ValueError('reconnect backoff cannot be negative')
        if max_buffered_frames <= 0:
            raise ValueError('max_buffered_frames must be positive')
        self._options = options
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
        self._connect_with_retry(initial=True)

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
        except Exception:
            with self._lock:
                self._ready = False
                self._buffer_audio(frame.data)
            self._reconnect(generation)

    def stop(self) -> None:
        with self._lock:
            if self._stopping:
                return
            self._stopping = True
            self._ready = False
            client = self._client
        if client is not None:
            try:
                # SDK stop sends finish-task and blocks for task-finished/error.
                client.stop()
            except Exception as error:
                self._emit(ProviderError(
                    provider=self.name,
                    message=(
                        'Fun-ASR stop failed '
                        f'({type(error).__name__})'
                    ),
                    fatal=False,
                ))
        self._emit_stopped()

    def handle_open(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation or self._stopping:
                return
            self._ready = True
        self._emit(ProviderReady(
            provider=self.name,
            message='Fun-ASR realtime task started.',
        ))

    def handle_complete(self, generation: int) -> None:
        if generation != self._generation:
            return
        self._emit_stopped()

    def handle_close(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation:
                return
            self._ready = False
            stopping = self._stopping
        if stopping:
            self._emit_stopped()
        else:
            self._reconnect(generation)

    def handle_error(self, generation: int) -> None:
        with self._lock:
            if generation != self._generation or self._stopping:
                return
            self._ready = False
        self._reconnect(generation)

    def handle_event(
        self,
        generation: int,
        result: FunAsrResult,
    ) -> None:
        if generation != self._generation or self._stopping:
            return
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

    def _connect_with_retry(self, initial: bool = False) -> None:
        attempts = self._max_reconnects + 1 if initial else 1
        for attempt in range(attempts):
            if self._stopping:
                return
            try:
                self._connect_once()
                self._flush_pending_audio()
                return
            except Exception as error:
                with self._lock:
                    self._ready = False
                if attempt + 1 >= attempts:
                    raise RuntimeError(
                        'Fun-ASR connection attempts exhausted'
                    ) from error
                self._sleeper(
                    self._reconnect_backoff_seconds * (2 ** attempt)
                )

    def _connect_once(self) -> None:
        with self._lock:
            self._generation += 1
            generation = self._generation
            self._task_started_at = self._clock()
            self._latest_audio_offset_ms = 0
        callback = FunAsrCallback(self, generation)
        client = self._client_factory(self._options, callback)
        with self._lock:
            if self._stopping:
                return
            self._client = client
        client.start()

    def _reconnect(self, failed_generation: int) -> None:
        with self._lock:
            if (
                failed_generation != self._generation
                or self._stopping
            ):
                return
            if self._reconnects >= self._max_reconnects:
                self._emit(ProviderError(
                    provider=self.name,
                    message='Fun-ASR reconnect attempts exhausted.',
                    fatal=True,
                ))
                return
            self._reconnects += 1
            attempt = self._reconnects
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
            self._connect_with_retry()
        except Exception:
            self._reconnect(self._generation)

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
