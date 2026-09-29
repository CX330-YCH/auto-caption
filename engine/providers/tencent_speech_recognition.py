import base64
import hashlib
import hmac
from collections.abc import Callable
from dataclasses import dataclass, field
from urllib.parse import quote, urlencode

from core import CaptionFinal, CaptionPartial, ProviderReady

from .tencent_speech_translate import (
    ClientFactory,
    TencentSpeechTranslateProvider,
    _WebSocketClient,
    _is_handshake_confirmation,
)


TENCENT_ASR_URL = 'wss://asr.cloud.tencent.com/asr/v2/'
CLASSIC_MODELS = (
    'Hy-ASR-3.0-preview',
    '8k_zh_large',
    '16k_zh_en',
    '16k_multi_lang',
    '16k_en_large',
    '8k_zh',
    '8k_en',
    '16k_zh',
    '16k_zh-TW',
    '16k_zh_edu',
    '16k_zh_medical',
    '16k_zh_court',
    '16k_yue',
    '16k_en',
    '16k_en_game',
    '16k_en_edu',
    '16k_ko',
    '16k_ja',
    '16k_th',
    '16k_id',
    '16k_vi',
    '16k_ms',
    '16k_fil',
    '16k_pt',
    '16k_tr',
    '16k_ar',
    '16k_es',
    '16k_hi',
    '16k_fr',
    '16k_de',
)
V2_MODELS = ('16k_zh_en_2.0', '16k_zh_en_speaker_2.0')


@dataclass(frozen=True)
class TencentRecognitionOptions:
    app_id: str
    secret_id: str = field(repr=False)
    secret_key: str = field(repr=False)
    model: str = '16k_zh_en'
    vad_silence_ms: int = 1000
    max_speak_time_ms: int = 60000


@dataclass(frozen=True)
class TencentRecognitionV2Options:
    app_id: str
    secret_id: str = field(repr=False)
    secret_key: str = field(repr=False)
    model: str = '16k_zh_en_2.0'
    vad_silence_ms: int = 1000
    sentence_strategy: int = 0


def _validate_credentials(options) -> None:
    if not options.app_id or not options.secret_id or not options.secret_key:
        raise ValueError('Tencent Cloud credentials are required')
    if not options.app_id.isdigit():
        raise ValueError('Tencent Cloud AppID must contain digits only')


def _validate_classic_options(options: TencentRecognitionOptions) -> None:
    _validate_credentials(options)
    if options.model not in CLASSIC_MODELS:
        raise ValueError('Unsupported Tencent realtime recognition model')
    if not 240 <= options.vad_silence_ms <= 2000:
        raise ValueError('Tencent VAD silence must be between 240 and 2000 ms')
    if not 5000 <= options.max_speak_time_ms <= 90000:
        raise ValueError('Tencent max speak time must be between 5000 and 90000 ms')


def _validate_v2_options(options: TencentRecognitionV2Options) -> None:
    _validate_credentials(options)
    if options.model not in V2_MODELS:
        raise ValueError('Unsupported Tencent realtime recognition V2 model')
    if not 240 <= options.vad_silence_ms <= 2000:
        raise ValueError('Tencent VAD silence must be between 240 and 2000 ms')
    if options.sentence_strategy not in (0, 1):
        raise ValueError('Tencent V2 sentence strategy must be 0 or 1')


def _build_asr_signed_url(
    options,
    *,
    timestamp: int,
    nonce: int,
    voice_id: str,
    v2: bool,
) -> str:
    (_validate_v2_options if v2 else _validate_classic_options)(options)
    params: dict[str, str | int] = {
        'secretid': options.secret_id,
        'timestamp': timestamp,
        'expired': timestamp + 24 * 60 * 60,
        'nonce': nonce,
        'engine_model_type': options.model,
        'voice_id': voice_id,
        'voice_format': 1,
        'needvad': 1,
        'vad_silence_time': options.vad_silence_ms,
    }
    if v2:
        params['sentence_strategy'] = options.sentence_strategy
        if options.model == '16k_zh_en_speaker_2.0':
            params['speaker_diarization'] = 1
    else:
        params['max_speak_time'] = options.max_speak_time_ms
    sorted_params = sorted(params.items())
    canonical_query = '&'.join(f'{key}={value}' for key, value in sorted_params)
    signing_text = (
        f'asr.cloud.tencent.com/asr/v2/{options.app_id}?{canonical_query}'
    )
    digest = hmac.new(
        options.secret_key.encode('utf-8'),
        signing_text.encode('utf-8'),
        hashlib.sha1,
    ).digest()
    signature = quote(base64.b64encode(digest).decode('ascii'), safe='')
    query = urlencode(sorted_params, quote_via=quote)
    return f'{TENCENT_ASR_URL}{options.app_id}?{query}&signature={signature}'


def build_recognition_signed_url(
    options: TencentRecognitionOptions,
    *,
    timestamp: int,
    nonce: int,
    voice_id: str,
) -> str:
    return _build_asr_signed_url(
        options,
        timestamp=timestamp,
        nonce=nonce,
        voice_id=voice_id,
        v2=False,
    )


def build_recognition_v2_signed_url(
    options: TencentRecognitionV2Options,
    *,
    timestamp: int,
    nonce: int,
    voice_id: str,
) -> str:
    return _build_asr_signed_url(
        options,
        timestamp=timestamp,
        nonce=nonce,
        voice_id=voice_id,
        v2=True,
    )


def _connection_details(options, now: int, voice_id: str) -> dict[str, object]:
    details: dict[str, object] = {
        'endpoint': 'asr.cloud.tencent.com',
        'path': f'/asr/v2/{options.app_id}',
        'appId': options.app_id,
        'voiceId': voice_id,
        'model': options.model,
        'voiceFormat': 1,
        'vadSilenceMs': options.vad_silence_ms,
        'timestamp': now,
        'expired': now + 24 * 60 * 60,
    }
    if isinstance(options, TencentRecognitionOptions):
        details['maxSpeakTimeMs'] = options.max_speak_time_ms
    else:
        details['sentenceStrategy'] = options.sentence_strategy
        details['speakerDiarization'] = (
            options.model == '16k_zh_en_speaker_2.0'
        )
    return details


def _client_factory(*, v2: bool) -> ClientFactory:
    def build(options, response, failure, close, diagnostic):
        url_builder = (
            lambda value, timestamp, nonce, voice_id: _build_asr_signed_url(
                value,
                timestamp=timestamp,
                nonce=nonce,
                voice_id=voice_id,
                v2=v2,
            )
        )
        return _WebSocketClient(
            options,
            response,
            failure,
            close,
            diagnostic,
            url_builder=url_builder,
            connection_details_builder=_connection_details,
            worker_name=(
                'tencent-speech-recognition-v2-websocket'
                if v2 else 'tencent-speech-recognition-websocket'
            ),
        )

    return build


class TencentSpeechRecognitionProvider(TencentSpeechTranslateProvider):
    service_label = 'Tencent realtime speech recognition'

    def __init__(
        self,
        options: TencentRecognitionOptions,
        client_factory: ClientFactory | None = None,
        clock: Callable | None = None,
    ) -> None:
        kwargs = {'client_factory': client_factory or _client_factory(v2=False)}
        if clock is not None:
            kwargs['clock'] = clock
        super().__init__(options, **kwargs)

    @property
    def name(self) -> str:
        return 'tencent_speech_recognition'

    def _validate_provider_options(self) -> None:
        _validate_classic_options(self._options)

    @property
    def _required_sample_rate(self) -> int:
        return 8000 if self._options.model.startswith('8k_') else 16000

    @property
    def _packet_bytes(self) -> int:
        return self._required_sample_rate * 2 // 5

    def _starting_details(self) -> dict[str, object]:
        return {
            'operation': 'tencent_speech_recognition.start',
            **_connection_details(self._options, 0, ''),
        }

    def _publish_caption(self, response, result) -> None:
        slice_type = result.get('slice_type')
        index = result.get('index')
        text = result.get('voice_text_str')
        start_ms = result.get('start_time')
        end_ms = result.get('end_time')
        if (
            slice_type not in (0, 1, 2)
            or not isinstance(index, int)
            or not isinstance(text, str)
            or not isinstance(start_ms, int) or start_ms < 0
            or not isinstance(end_ms, int) or end_ms < start_ms
            or self._session_started_at is None
        ):
            self.handle_transport_error(
                ValueError('Tencent recognition result has invalid fields'),
                'tencent_speech_recognition.caption_result',
            )
            return
        if not text:
            return
        self._emit_asr_caption(str(index), text, start_ms, end_ms, slice_type == 2)

    def _emit_asr_caption(
        self,
        sentence_id: str,
        text: str,
        start_ms: int,
        end_ms: int,
        is_final: bool,
        speaker_id: int | None = None,
    ) -> None:
        caption_id = self._caption_ids.get(sentence_id)
        if caption_id is None:
            self._next_caption_id += 1
            caption_id = self._next_caption_id
            self._caption_ids[sentence_id] = caption_id
        if sentence_id in self._final_sentence_ids:
            return
        if is_final:
            self._final_sentence_ids.add(sentence_id)
            self._final_results += 1
        else:
            self._partial_results += 1
        event_type = CaptionFinal if is_final else CaptionPartial
        self._emit(event_type(
            caption_id=caption_id,
            started_at=self._format_time(start_ms),
            ended_at=self._format_time(end_ms),
            text=text,
            speaker_id=speaker_id,
        ))


class TencentSpeechRecognitionV2Provider(TencentSpeechRecognitionProvider):
    service_label = 'Tencent realtime speech recognition V2'

    def __init__(
        self,
        options: TencentRecognitionV2Options,
        client_factory: ClientFactory | None = None,
        clock: Callable | None = None,
    ) -> None:
        self._last_snapshots: dict[str, tuple[object, ...]] = {}
        kwargs = {'client_factory': client_factory or _client_factory(v2=True)}
        if clock is not None:
            kwargs['clock'] = clock
        TencentSpeechTranslateProvider.__init__(self, options, **kwargs)

    @property
    def name(self) -> str:
        return 'tencent_speech_recognition_v2'

    def _validate_provider_options(self) -> None:
        _validate_v2_options(self._options)

    def _starting_details(self) -> dict[str, object]:
        return {
            'operation': 'tencent_speech_recognition_v2.start',
            **_connection_details(self._options, 0, ''),
        }

    def handle_response(self, response: dict[str, object]) -> None:
        self._responses_received += 1
        code = response.get('code')
        if not isinstance(code, int):
            self.handle_transport_error(
                ValueError('Tencent response code must be an integer'),
                'tencent_speech_recognition_v2.response',
            )
            return
        if code != 0:
            self._handle_service_error(response, code)
            return
        sentences = response.get('sentences')
        if sentences is None:
            if not self._ready and _is_handshake_confirmation(response):
                self._ready = True
                self._emit(ProviderReady(
                    provider=self.name,
                    message=f'{self.service_label} started.',
                ))
            return
        sentence_list = (
            sentences.get('sentence_list')
            if isinstance(sentences, dict)
            else sentences
        )
        if not isinstance(sentence_list, list):
            self.handle_transport_error(
                ValueError('Tencent V2 sentences must contain a sentence list'),
                'tencent_speech_recognition_v2.response',
            )
            return
        for sentence in sentence_list:
            self._publish_v2_sentence(sentence)
            if self._failed:
                break

    def _publish_v2_sentence(self, sentence: object) -> None:
        if not isinstance(sentence, dict):
            self.handle_transport_error(
                ValueError('Tencent V2 sentence must be an object'),
                'tencent_speech_recognition_v2.caption_result',
            )
            return
        sentence_id = sentence.get('sentence_id')
        text = sentence.get('sentence')
        sentence_type = sentence.get('sentence_type')
        speaker_id = sentence.get('speaker_id', -1)
        start_ms = sentence.get('start_time')
        end_ms = sentence.get('end_time')
        if (
            not isinstance(sentence_id, int)
            or not isinstance(text, str)
            or sentence_type not in (0, 1)
            or not isinstance(speaker_id, int) or not -1 <= speaker_id <= 9
            or not isinstance(start_ms, int) or start_ms < 0
            or not isinstance(end_ms, int) or end_ms < start_ms
            or self._session_started_at is None
        ):
            self.handle_transport_error(
                ValueError('Tencent V2 caption result has invalid fields'),
                'tencent_speech_recognition_v2.caption_result',
            )
            return
        key = str(sentence_id)
        snapshot = (text, sentence_type, speaker_id, start_ms, end_ms)
        if self._last_snapshots.get(key) == snapshot:
            return
        self._last_snapshots[key] = snapshot
        if text:
            self._emit_asr_caption(
                key,
                text,
                start_ms,
                end_ms,
                sentence_type == 1,
                None if speaker_id == -1 else speaker_id,
            )
