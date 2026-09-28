import base64
import hashlib
import hmac
import json
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Protocol
from urllib.parse import quote, urlencode

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    exception_diagnostic,
)


TENCENT_SPEECH_URL = 'wss://asr.cloud.tencent.com/asr/speech_translate/'
SUPPORTED_MODELS = (
    'hunyuan-translation-lite',
    'hunyuan-translation',
)
TARGETS_BY_SOURCE = {
    'zh': ('zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'),
    'en': ('zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'),
    'zh_en': ('zh_en', 'zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'),
    'ja': ('zh', 'en', 'ja', 'ko', 'yue'),
    'ko': ('zh', 'en', 'ja', 'ko', 'yue'),
    'yue': ('zh', 'en', 'ja', 'ko', 'yue'),
    'id': ('zh', 'en', 'id'),
    'th': ('zh', 'en', 'th'),
    'ru': ('zh', 'en', 'ru'),
}
PCM_PACKET_BYTES = 6400


@dataclass(frozen=True)
class TencentHotword:
    """Reserved request-level hotword contract; no UI enables it yet."""

    text: str
    weight: int


def encode_hotword_list(hotwords: tuple[TencentHotword, ...]) -> str:
    if len(hotwords) > 128:
        raise ValueError('Tencent hotwords cannot exceed 128 entries')
    encoded = []
    for hotword in hotwords:
        if not hotword.text or ' ' in hotword.text or len(hotword.text) > 30:
            raise ValueError('Invalid Tencent hotword text')
        if hotword.weight not in (*range(1, 12), 100):
            raise ValueError('Invalid Tencent hotword weight')
        encoded.append(f'{hotword.text}|{hotword.weight}')
    return ','.join(encoded)


@dataclass(frozen=True)
class TencentSpeechOptions:
    app_id: str
    secret_id: str = field(repr=False)
    secret_key: str = field(repr=False)
    source_language: str
    target_language: str
    model: str = 'hunyuan-translation-lite'
    vad_silence_ms: int = 1000
    max_speak_time_ms: int = 10000
    hotwords: tuple[TencentHotword, ...] = ()


class TencentSpeechClient(Protocol):
    def start(self) -> None: ...
    def send_audio(self, data: bytes) -> None: ...
    def stop(self) -> None: ...


ResponseHandler = Callable[[dict[str, object]], None]
FailureHandler = Callable[[str], None]
CloseHandler = Callable[[], None]
ClientFactory = Callable[
    [TencentSpeechOptions, ResponseHandler, FailureHandler, CloseHandler],
    TencentSpeechClient,
]


def build_signed_url(
    options: TencentSpeechOptions,
    *,
    timestamp: int,
    nonce: int,
    voice_id: str,
) -> str:
    _validate_options(options)
    params: dict[str, str | int] = {
        'secretid': options.secret_id,
        'timestamp': timestamp,
        'expired': timestamp + 24 * 60 * 60,
        'nonce': nonce,
        'voice_id': voice_id,
        'voice_format': 1,
        'source': options.source_language,
        'target': options.target_language,
        'trans_model': options.model,
        'enable_tts': 0,
    }
    if options.source_language in ('zh', 'en', 'zh_en'):
        params['vad_silence_time'] = options.vad_silence_ms
        params['max_speak_time'] = options.max_speak_time_ms
    hotword_list = encode_hotword_list(options.hotwords)
    if hotword_list:
        params['hotword_list'] = hotword_list
    sorted_params = sorted(params.items())
    canonical_query = '&'.join(f'{key}={value}' for key, value in sorted_params)
    query = urlencode(sorted_params, quote_via=quote)
    signing_text = (
        'asr.cloud.tencent.com/asr/speech_translate/'
        f'{options.app_id}?{canonical_query}'
    )
    digest = hmac.new(
        options.secret_key.encode('utf-8'),
        signing_text.encode('utf-8'),
        hashlib.sha1,
    ).digest()
    signature = quote(base64.b64encode(digest).decode('ascii'), safe='')
    return f'{TENCENT_SPEECH_URL}{options.app_id}?{query}&signature={signature}'


def _validate_options(options: TencentSpeechOptions) -> None:
    if not options.app_id or not options.secret_id or not options.secret_key:
        raise ValueError('Tencent Cloud credentials are required')
    if not options.app_id.isdigit():
        raise ValueError('Tencent Cloud AppID must contain digits only')
    if options.model not in SUPPORTED_MODELS:
        raise ValueError('Unsupported Tencent translation model')
    targets = TARGETS_BY_SOURCE.get(options.source_language)
    if targets is None or options.target_language not in targets:
        raise ValueError('Unsupported Tencent translation language pair')
    if not 500 <= options.vad_silence_ms <= 2000:
        raise ValueError('Tencent VAD silence must be between 500 and 2000 ms')
    if not 5000 <= options.max_speak_time_ms <= 90000:
        raise ValueError('Tencent max speak time must be between 5000 and 90000 ms')


class _WebSocketClient:
    def __init__(
        self,
        options: TencentSpeechOptions,
        response_handler: ResponseHandler,
        failure_handler: FailureHandler,
        close_handler: CloseHandler,
        start_timeout: float = 10.0,
        finish_timeout: float = 5.0,
    ) -> None:
        self._options = options
        self._response_handler = response_handler
        self._failure_handler = failure_handler
        self._close_handler = close_handler
        self._start_timeout = start_timeout
        self._finish_timeout = finish_timeout
        self._ready = threading.Event()
        self._handshake_succeeded = threading.Event()
        self._finished = threading.Event()
        self._failed = threading.Event()
        self._closing = False
        self._websocket = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        import websocket

        now = int(time.time())
        url = build_signed_url(
            self._options,
            timestamp=now,
            nonce=now % 10_000_000_000,
            voice_id=str(uuid.uuid4()),
        )
        self._websocket = websocket.WebSocketApp(
            url,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
        )
        self._thread = threading.Thread(
            target=self._websocket.run_forever,
            name='tencent-speech-websocket',
            daemon=True,
        )
        self._thread.start()
        if not self._ready.wait(self._start_timeout):
            self._closing = True
            self._websocket.close()
            raise TimeoutError('Tencent WebSocket handshake timed out')
        if (
            self._failed.is_set() or
            not self._handshake_succeeded.is_set()
        ):
            raise ConnectionError('Tencent WebSocket handshake failed')

    def send_audio(self, data: bytes) -> None:
        import websocket

        if not self._ready.is_set() or self._failed.is_set() or self._closing:
            raise ConnectionError('Tencent WebSocket is not ready')
        self._websocket.send(data, opcode=websocket.ABNF.OPCODE_BINARY)

    def stop(self) -> None:
        if self._websocket is None:
            return
        self._closing = True
        if self._ready.is_set() and not self._failed.is_set():
            self._websocket.send(json.dumps({'type': 'end'}))
            if not self._finished.wait(self._finish_timeout):
                self._websocket.close()
                raise TimeoutError('Tencent final result timed out')
        self._websocket.close()
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def _on_message(self, ws, message: str) -> None:
        try:
            response = json.loads(message)
            if not isinstance(response, dict):
                raise ValueError('Tencent response must be an object')
            code = response.get('code')
            if not isinstance(code, int):
                raise ValueError('Tencent response code must be an integer')
            if not self._handshake_succeeded.is_set():
                if code != 0:
                    self._failed.set()
                    try:
                        self._response_handler(response)
                    finally:
                        self._ready.set()
                    return
                if response.get('final') is not None or 'result' in response:
                    raise ValueError(
                        'Tencent result arrived before handshake confirmation'
                    )
                self._response_handler(response)
                self._handshake_succeeded.set()
                self._ready.set()
                return
            self._response_handler(response)
            if code != 0:
                self._failed.set()
            elif response.get('final') == 1:
                self._finished.set()
        except Exception as error:
            self._failed.set()
            try:
                self._failure_handler(type(error).__name__)
            finally:
                self._ready.set()

    def _on_error(self, ws, error: object) -> None:
        if self._closing:
            return
        self._failed.set()
        try:
            self._failure_handler(type(error).__name__)
        finally:
            self._ready.set()

    def _on_close(self, ws, status_code=None, message=None) -> None:
        if self._failed.is_set():
            return
        if self._closing:
            self._ready.set()
            return
        if self._handshake_succeeded.is_set() and self._finished.is_set():
            return
        self._failed.set()
        try:
            self._close_handler()
        finally:
            self._ready.set()


def _build_client(
    options: TencentSpeechOptions,
    response_handler: ResponseHandler,
    failure_handler: FailureHandler,
    close_handler: CloseHandler,
) -> TencentSpeechClient:
    return _WebSocketClient(
        options,
        response_handler,
        failure_handler,
        close_handler,
    )


class TencentSpeechTranslateProvider(RecognitionProvider):
    def __init__(
        self,
        options: TencentSpeechOptions,
        client_factory: ClientFactory = _build_client,
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        super().__init__()
        self._options = options
        self._client_factory = client_factory
        self._clock = clock
        self._client: TencentSpeechClient | None = None
        self._session_started_at: datetime | None = None
        self._pending_audio = bytearray()
        self._caption_ids: dict[str, int] = {}
        self._final_sentence_ids: set[str] = set()
        self._next_caption_id = 0
        self._ready = False
        self._stopping = False
        self._failed = False

    @property
    def name(self) -> str:
        return 'tencent_speech_translate'

    def start(self) -> None:
        try:
            _validate_options(self._options)
            self._session_started_at = self._clock()
            self._client = self._client_factory(
                self._options,
                self.handle_response,
                self.handle_transport_error,
                self.handle_close,
            )
            self._client.start()
            if not self._ready:
                raise ConnectionError(
                    'Tencent client returned before handshake confirmation'
                )
        except Exception as error:
            if self._failed:
                return
            self._failed = True
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    'Tencent speech translation failed to start '
                    f'({type(error).__name__})'
                ),
                fatal=True,
                details=exception_diagnostic(
                    error,
                    operation='tencent_speech.start',
                    secrets=self._secrets,
                ),
            ))

    def accept_audio(self, frame: AudioFrame) -> None:
        if not self._ready or self._client is None:
            raise RuntimeError('Tencent speech translation is not ready')
        if frame.format != 'pcm_s16le' or frame.sample_rate != 16000:
            raise ValueError('Tencent speech translation requires 16 kHz PCM16')
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('Tencent speech translation requires mono PCM16')
        self._pending_audio.extend(frame.data)
        try:
            while len(self._pending_audio) >= PCM_PACKET_BYTES:
                packet = bytes(self._pending_audio[:PCM_PACKET_BYTES])
                del self._pending_audio[:PCM_PACKET_BYTES]
                self._client.send_audio(packet)
        except Exception as error:
            self._failed = True
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    'Tencent audio upload failed '
                    f'({type(error).__name__})'
                ),
                fatal=True,
                details=exception_diagnostic(
                    error,
                    operation='tencent_speech.send_audio',
                    secrets=self._secrets,
                ),
            ))

    def stop(self) -> None:
        if self._stopping:
            return
        self._stopping = True
        try:
            if (
                self._client is not None and
                self._ready and
                not self._failed and
                self._pending_audio
            ):
                self._client.send_audio(bytes(self._pending_audio))
            self._pending_audio.clear()
            if self._client is not None:
                self._client.stop()
        except Exception as error:
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    'Tencent speech translation failed to stop '
                    f'({type(error).__name__})'
                ),
                fatal=False,
                details=exception_diagnostic(
                    error,
                    operation='tencent_speech.stop',
                    secrets=self._secrets,
                ),
            ))
        finally:
            self._ready = False
            self._emit(ProviderStopped(
                provider=self.name,
                message='Tencent speech translation stopped.',
            ))

    def handle_response(self, response: dict[str, object]) -> None:
        code = response.get('code')
        if not isinstance(code, int):
            self.handle_transport_error('InvalidResponse')
            return
        if code != 0:
            self._failed = True
            self._emit(ProviderError(
                provider=self.name,
                message=f'Tencent speech translation failed (code {code})',
                fatal=True,
                details={
                    'operation': 'tencent_speech.response',
                    'errorType': 'TencentServiceError',
                    'serviceCode': code,
                },
            ))
            return
        result = response.get('result')
        if result is None:
            if not self._ready and response.get('final') is None:
                self._ready = True
                self._emit(ProviderReady(
                    provider=self.name,
                    message='Tencent speech translation started.',
                ))
            return
        if not isinstance(result, dict):
            self.handle_transport_error('InvalidResult')
            return
        self._publish_caption(response, result)

    def handle_transport_error(self, error_type: str) -> None:
        if self._stopping or self._failed:
            return
        self._failed = True
        self._emit(ProviderError(
            provider=self.name,
            message='Tencent speech translation connection failed.',
            fatal=True,
            details={
                'operation': 'tencent_speech.websocket',
                'errorType': error_type[:128],
            },
        ))

    def handle_close(self) -> None:
        if not self._stopping and not self._failed:
            self.handle_transport_error('UnexpectedClose')

    def _publish_caption(
        self,
        response: dict[str, object],
        result: dict[str, object],
    ) -> None:
        sentence_id = response.get('sentence_id')
        text = result.get('source_text')
        translation = result.get('target_text')
        start_ms = result.get('start_time')
        end_ms = result.get('end_time')
        sentence_end = result.get('sentence_end')
        if (
            not isinstance(sentence_id, str) or not sentence_id or
            not isinstance(text, str) or
            not isinstance(translation, str) or
            not isinstance(start_ms, int) or start_ms < 0 or
            not isinstance(end_ms, int) or end_ms < start_ms or
            not isinstance(sentence_end, bool) or
            self._session_started_at is None
        ):
            self.handle_transport_error('InvalidCaptionResult')
            return
        caption_id = self._caption_ids.get(sentence_id)
        if caption_id is None:
            self._next_caption_id += 1
            caption_id = self._next_caption_id
            self._caption_ids[sentence_id] = caption_id
        if sentence_id in self._final_sentence_ids:
            return
        event_type = CaptionFinal if sentence_end else CaptionPartial
        if sentence_end:
            self._final_sentence_ids.add(sentence_id)
        self._emit(event_type(
            caption_id=caption_id,
            started_at=self._format_time(start_ms),
            ended_at=self._format_time(end_ms),
            text=text,
            translation=translation,
        ))

    def _format_time(self, offset_ms: int) -> str:
        value = self._session_started_at + timedelta(milliseconds=offset_ms)
        return value.strftime('%H:%M:%S.%f')[:-3]

    @property
    def _secrets(self) -> tuple[str, ...]:
        return (
            self._options.secret_id,
            self._options.secret_key,
        )
