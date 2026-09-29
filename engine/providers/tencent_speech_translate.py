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
from typing import Any, Protocol
from urllib.parse import quote, urlencode

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderDebug,
    ProviderError,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    exception_diagnostic,
    safe_diagnostic_value,
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
FailureHandler = Callable[[BaseException, str], None]
CloseHandler = Callable[[int | None, str | None], None]
DiagnosticHandler = Callable[[str, dict[str, object]], None]
ClientFactory = Callable[
    [
        TencentSpeechOptions,
        ResponseHandler,
        FailureHandler,
        CloseHandler,
        DiagnosticHandler,
    ],
    TencentSpeechClient,
]

UrlBuilder = Callable[[Any, int, int, str], str]
ConnectionDetailsBuilder = Callable[[Any, int, str], dict[str, object]]


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


def _is_handshake_confirmation(response: dict[str, object]) -> bool:
    return (
        response.get('code') == 0 and
        response.get('result') is None and
        response.get('sentences') is None and
        response.get('final') in (None, 0)
    )


class _WebSocketClient:
    def __init__(
        self,
        options: TencentSpeechOptions,
        response_handler: ResponseHandler,
        failure_handler: FailureHandler,
        close_handler: CloseHandler,
        diagnostic_handler: DiagnosticHandler = lambda message, details: None,
        start_timeout: float = 10.0,
        finish_timeout: float = 5.0,
        url_builder: UrlBuilder | None = None,
        connection_details_builder: ConnectionDetailsBuilder | None = None,
        worker_name: str = 'tencent-speech-websocket',
    ) -> None:
        self._options = options
        self._response_handler = response_handler
        self._failure_handler = failure_handler
        self._close_handler = close_handler
        self._diagnostic_handler = diagnostic_handler
        self._start_timeout = start_timeout
        self._finish_timeout = finish_timeout
        self._url_builder = url_builder
        self._connection_details_builder = connection_details_builder
        self._worker_name = worker_name
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
        voice_id = str(uuid.uuid4())
        nonce = now % 10_000_000_000
        url = (
            self._url_builder(self._options, now, nonce, voice_id)
            if self._url_builder is not None
            else build_signed_url(
                self._options,
                timestamp=now,
                nonce=nonce,
                voice_id=voice_id,
            )
        )
        connection_details = (
            self._connection_details_builder(self._options, now, voice_id)
            if self._connection_details_builder is not None
            else {
                'endpoint': 'asr.cloud.tencent.com',
                'path': f'/asr/speech_translate/{self._options.app_id}',
                'appId': self._options.app_id,
                'voiceId': voice_id,
                'sourceLanguage': self._options.source_language,
                'targetLanguage': self._options.target_language,
                'model': self._options.model,
                'voiceFormat': 1,
                'ttsEnabled': False,
                'vadSilenceMs': self._options.vad_silence_ms,
                'maxSpeakTimeMs': self._options.max_speak_time_ms,
                'hotwordCount': len(self._options.hotwords),
                'timestamp': now,
                'expired': now + 24 * 60 * 60,
            }
        )
        self._diagnostic_handler(
            'Tencent WebSocket connection starting.',
            {
                'operation': 'tencent_speech.websocket.start',
                **connection_details,
                'startTimeoutSeconds': self._start_timeout,
            },
        )
        self._websocket = websocket.WebSocketApp(
            url,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
        )
        self._websocket.on_open = self._on_open
        self._thread = threading.Thread(
            target=self._websocket.run_forever,
            name=self._worker_name,
            daemon=True,
        )
        self._thread.start()
        self._diagnostic_handler(
            'Tencent WebSocket worker started.',
            {
                'operation': 'tencent_speech.websocket.start',
                'threadName': self._thread.name,
            },
        )
        if not self._ready.wait(self._start_timeout):
            self._closing = True
            self._websocket.close()
            raise TimeoutError('Tencent WebSocket handshake timed out')
        self._diagnostic_handler(
            'Tencent WebSocket startup wait completed.',
            {
                'operation': 'tencent_speech.websocket.start',
                **self._state_details(),
            },
        )
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
        self._diagnostic_handler(
            'Tencent WebSocket stop requested.',
            {
                'operation': 'tencent_speech.websocket.stop',
                **self._state_details(),
                'finishTimeoutSeconds': self._finish_timeout,
            },
        )
        if self._ready.is_set() and not self._failed.is_set():
            self._websocket.send(json.dumps({'type': 'end'}))
            self._diagnostic_handler(
                'Tencent WebSocket end message sent.',
                {'operation': 'tencent_speech.websocket.stop'},
            )
            if not self._finished.wait(self._finish_timeout):
                self._websocket.close()
                raise TimeoutError('Tencent final result timed out')
        self._websocket.close()
        if self._thread is not None:
            self._thread.join(timeout=1.0)
        self._diagnostic_handler(
            'Tencent WebSocket stop completed.',
            {
                'operation': 'tencent_speech.websocket.stop',
                **self._state_details(),
                'workerAlive': bool(
                    self._thread is not None and self._thread.is_alive()
                ),
            },
        )

    def _on_open(self, ws) -> None:
        self._diagnostic_handler(
            'Tencent WebSocket transport opened.',
            {
                'operation': 'tencent_speech.websocket.on_open',
                **self._state_details(),
            },
        )

    def _on_message(self, ws, message: str) -> None:
        message_details = self._message_details(message)
        response: object | None = None
        try:
            response = json.loads(message)
            if not isinstance(response, dict):
                raise ValueError('Tencent response must be an object')
            code = response.get('code')
            if not isinstance(code, int):
                raise ValueError('Tencent response code must be an integer')
            self._diagnostic_handler(
                'Tencent WebSocket message received.',
                {
                    'operation': 'tencent_speech.websocket.on_message',
                    **message_details,
                    'handshakeSucceededBefore': (
                        self._handshake_succeeded.is_set()
                    ),
                    'response': response,
                },
            )
            if not self._handshake_succeeded.is_set():
                if code != 0:
                    self._failed.set()
                    try:
                        self._response_handler(response)
                    finally:
                        self._ready.set()
                    return
                if not _is_handshake_confirmation(response):
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
            elif response.get('final') in (1, 2):
                self._finished.set()
        except Exception as error:
            self._failed.set()
            details = exception_diagnostic(
                error,
                operation='tencent_speech.websocket.on_message',
                secrets=(
                    self._options.secret_id,
                    self._options.secret_key,
                ),
            )
            details.update(message_details)
            details.update(self._state_details())
            if response is not None:
                details['response'] = safe_diagnostic_value(
                    response,
                    secrets=(
                        self._options.secret_id,
                        self._options.secret_key,
                    ),
                )
            self._diagnostic_handler(
                'Tencent WebSocket message handling failed.',
                details,
            )
            try:
                self._failure_handler(
                    error,
                    'tencent_speech.websocket.on_message',
                )
            finally:
                self._ready.set()

    def _on_error(self, ws, error: object) -> None:
        if self._closing:
            self._diagnostic_handler(
                'Ignored Tencent WebSocket error while closing.',
                {
                    'operation': 'tencent_speech.websocket.on_error',
                    'error': error,
                    **self._state_details(),
                },
            )
            return
        exception = (
            error if isinstance(error, BaseException)
            else RuntimeError(str(error))
        )
        self._failed.set()
        details = exception_diagnostic(
            exception,
            operation='tencent_speech.websocket.on_error',
            secrets=(
                self._options.secret_id,
                self._options.secret_key,
            ),
        )
        details.update(self._state_details())
        self._diagnostic_handler(
            'Tencent WebSocket transport error.',
            details,
        )
        try:
            self._failure_handler(
                exception,
                'tencent_speech.websocket.on_error',
            )
        finally:
            self._ready.set()

    def _on_close(self, ws, status_code=None, message=None) -> None:
        normalized_status = status_code if isinstance(status_code, int) else None
        normalized_message = message if isinstance(message, str) else None
        self._diagnostic_handler(
            'Tencent WebSocket transport closed.',
            {
                'operation': 'tencent_speech.websocket.on_close',
                'statusCode': normalized_status,
                'closeMessage': normalized_message,
                **self._state_details(),
            },
        )
        if self._failed.is_set():
            return
        if self._closing:
            self._ready.set()
            return
        if self._handshake_succeeded.is_set() and self._finished.is_set():
            return
        self._failed.set()
        try:
            self._close_handler(normalized_status, normalized_message)
        finally:
            self._ready.set()

    def _state_details(self) -> dict[str, object]:
        return {
            'readyEventSet': self._ready.is_set(),
            'handshakeSucceeded': self._handshake_succeeded.is_set(),
            'finished': self._finished.is_set(),
            'failed': self._failed.is_set(),
            'closing': self._closing,
        }

    @staticmethod
    def _message_details(message: object) -> dict[str, object]:
        if isinstance(message, str):
            encoded = message.encode('utf-8', errors='replace')
            return {
                'payloadType': 'text',
                'payloadBytes': len(encoded),
                'payloadSha256': hashlib.sha256(encoded).hexdigest(),
            }
        if isinstance(message, bytes):
            return {
                'payloadType': 'bytes',
                'payloadBytes': len(message),
                'payloadSha256': hashlib.sha256(message).hexdigest(),
            }
        return {
            'payloadType': type(message).__name__,
            'payloadBytes': None,
        }


def _build_client(
    options: TencentSpeechOptions,
    response_handler: ResponseHandler,
    failure_handler: FailureHandler,
    close_handler: CloseHandler,
    diagnostic_handler: DiagnosticHandler,
) -> TencentSpeechClient:
    return _WebSocketClient(
        options,
        response_handler,
        failure_handler,
        close_handler,
        diagnostic_handler,
    )


class TencentSpeechTranslateProvider(RecognitionProvider):
    service_label = 'Tencent speech translation'

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
        self._audio_frames_accepted = 0
        self._network_packets_sent = 0
        self._network_bytes_sent = 0
        self._responses_received = 0
        self._partial_results = 0
        self._final_results = 0

    @property
    def name(self) -> str:
        return 'tencent_speech_translate'

    def start(self) -> None:
        try:
            self._validate_provider_options()
            self._debug(
                f'{self.service_label} provider starting.',
                self._starting_details(),
            )
            self._session_started_at = self._clock()
            self._client = self._client_factory(
                self._options,
                self.handle_response,
                self.handle_transport_error,
                self.handle_close,
                self._debug,
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
                    f'{self.service_label} failed to start '
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
            raise RuntimeError(f'{self.service_label} is not ready')
        if (
            frame.format != 'pcm_s16le' or
            frame.sample_rate != self._required_sample_rate
        ):
            raise ValueError(
                f'{self.service_label} requires '
                f'{self._required_sample_rate // 1000} kHz PCM16'
            )
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError(f'{self.service_label} requires mono PCM16')
        self._audio_frames_accepted += 1
        self._pending_audio.extend(frame.data)
        try:
            while len(self._pending_audio) >= self._packet_bytes:
                packet = bytes(self._pending_audio[:self._packet_bytes])
                del self._pending_audio[:self._packet_bytes]
                self._client.send_audio(packet)
                self._record_audio_packet(packet, tail=False)
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
                tail = bytes(self._pending_audio)
                self._client.send_audio(tail)
                self._record_audio_packet(tail, tail=True)
            self._pending_audio.clear()
            if self._client is not None:
                self._client.stop()
        except Exception as error:
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    f'{self.service_label} failed to stop '
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
                message=f'{self.service_label} stopped.',
            ))

    def handle_response(self, response: dict[str, object]) -> None:
        self._responses_received += 1
        code = response.get('code')
        if not isinstance(code, int):
            self.handle_transport_error(
                ValueError('Tencent response code must be an integer'),
                'tencent_speech.response',
            )
            return
        if code != 0:
            self._handle_service_error(response, code)
            return
        result = response.get('result')
        if result is None:
            if not self._ready and _is_handshake_confirmation(response):
                self._ready = True
                self._emit(ProviderReady(
                    provider=self.name,
                    message=f'{self.service_label} started.',
                ))
            return
        if not isinstance(result, dict):
            self.handle_transport_error(
                ValueError('Tencent result must be an object'),
                'tencent_speech.response',
            )
            return
        self._publish_caption(response, result)

    def _handle_service_error(
        self,
        response: dict[str, object],
        code: int,
    ) -> None:
        self._failed = True
        safe_response = safe_diagnostic_value(
            response,
            secrets=self._secrets,
        )
        safe_mapping = safe_response if isinstance(safe_response, dict) else {}
        service_message = safe_mapping.get('message')
        self._emit(ProviderError(
            provider=self.name,
            message=f'{self.service_label} failed (code {code})',
            fatal=True,
            details={
                'operation': 'tencent_speech.response',
                'errorType': 'TencentServiceError',
                'serviceCode': code,
                'serviceMessage': (
                    service_message if isinstance(service_message, str) else ''
                ),
                'response': safe_mapping,
            },
        ))

    def handle_transport_error(
        self,
        error: BaseException,
        operation: str,
    ) -> None:
        if self._stopping or self._failed:
            return
        self._failed = True
        details = exception_diagnostic(
            error,
            operation=operation,
            secrets=self._secrets,
        )
        self._emit(ProviderError(
            provider=self.name,
            message=f'{self.service_label} connection failed.',
            fatal=True,
            details=details,
        ))

    def handle_close(
        self,
        status_code: int | None,
        message: str | None,
    ) -> None:
        if not self._stopping and not self._failed:
            suffix = f' ({status_code})' if status_code is not None else ''
            reason = f': {message}' if message else ''
            self.handle_transport_error(
                ConnectionError(
                    f'Tencent WebSocket closed unexpectedly{suffix}{reason}'
                ),
                'tencent_speech.websocket.on_close',
            )

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
            self.handle_transport_error(
                ValueError('Tencent caption result has invalid fields'),
                'tencent_speech.caption_result',
            )
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
            self._final_results += 1
        else:
            self._partial_results += 1
        self._emit(event_type(
            caption_id=caption_id,
            started_at=self._format_time(start_ms),
            ended_at=self._format_time(end_ms),
            text=text,
            translation=translation,
        ))

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {
            **super().diagnostic_snapshot(),
            'ready': self._ready,
            'stopping': self._stopping,
            'failed': self._failed,
            'pendingAudioBytes': len(self._pending_audio),
            'audioFramesAccepted': self._audio_frames_accepted,
            'networkPacketsSent': self._network_packets_sent,
            'networkBytesSent': self._network_bytes_sent,
            'responsesReceived': self._responses_received,
            'partialResults': self._partial_results,
            'finalResults': self._final_results,
            'trackedSentences': len(self._caption_ids),
        }

    def _record_audio_packet(self, packet: bytes, *, tail: bool) -> None:
        self._network_packets_sent += 1
        self._network_bytes_sent += len(packet)
        self._debug(
            'Tencent WebSocket audio packet sent.',
            {
                'operation': 'tencent_speech.send_audio',
                'packetBytes': len(packet),
                'packetIndex': self._network_packets_sent,
                'totalBytes': self._network_bytes_sent,
                'tailPacket': tail,
            },
        )

    def _validate_provider_options(self) -> None:
        _validate_options(self._options)

    @property
    def _required_sample_rate(self) -> int:
        return 16000

    @property
    def _packet_bytes(self) -> int:
        return PCM_PACKET_BYTES

    def _starting_details(self) -> dict[str, object]:
        return {
            'operation': 'tencent_speech.start',
            'appId': self._options.app_id,
            'sourceLanguage': self._options.source_language,
            'targetLanguage': self._options.target_language,
            'model': self._options.model,
            'vadSilenceMs': self._options.vad_silence_ms,
            'maxSpeakTimeMs': self._options.max_speak_time_ms,
            'hotwordCount': len(self._options.hotwords),
        }

    def _debug(self, message: str, details: dict[str, object]) -> None:
        if not self._debug_enabled():
            return
        safe_details = safe_diagnostic_value(details, secrets=self._secrets)
        self._emit(ProviderDebug(
            provider=self.name,
            message=message,
            details=(
                safe_details if isinstance(safe_details, dict) else {}
            ),
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
