import json
import re
import sys
from dataclasses import dataclass
from typing import Any, Protocol, TextIO
from urllib.parse import urlparse

from core import exception_diagnostic


SUPPORTED_FUN_ASR_MODELS = (
    'fun-asr-realtime',
    'fun-asr-realtime-2025-11-07',
)
SUPPORTED_HOTWORD_LANGUAGES = ('zh', 'en', 'ja')


@dataclass(frozen=True)
class HotwordRuntimeConfig:
    vocabulary_id: str = ''
    target_model: str = 'fun-asr-realtime'
    context_terms: tuple[str, ...] = ()

    def recognition_client_options(self, recognition_model: str) -> dict:
        if (
            self.vocabulary_id
            and self.target_model != recognition_model
        ):
            raise ValueError('Hotword target model mismatch')
        if self.vocabulary_id:
            _validate_vocabulary_id(self.vocabulary_id)
            return {'vocabulary_id': self.vocabulary_id}
        return {}

    def recognition_start_options(self, recognition_model: str) -> dict:
        self.recognition_client_options(recognition_model)
        terms = _validate_context_terms(self.context_terms)
        options: dict[str, Any] = {}
        if terms:
            options['raw_input'] = {
                'context': [{
                    'role': 'user',
                    'content': [{
                        'type': 'input_text',
                        'text': '\n'.join(terms),
                    }],
                }],
            }
        return options


class VocabularyClient(Protocol):
    def create_vocabulary(
        self,
        target_model: str,
        prefix: str,
        vocabulary: list[dict],
    ) -> str: ...
    def list_vocabularies(
        self,
        prefix: str | None = None,
        page_index: int = 0,
        page_size: int = 10,
    ) -> list[dict]: ...
    def query_vocabulary(self, vocabulary_id: str) -> dict: ...
    def update_vocabulary(
        self,
        vocabulary_id: str,
        vocabulary: list[dict],
    ) -> None: ...
    def delete_vocabulary(self, vocabulary_id: str) -> None: ...


@dataclass(frozen=True)
class HotwordConnection:
    workspace_id: str
    websocket_url: str
    model: str
    api_key: str


class HotwordModelMismatchError(RuntimeError):
    pass


class HotwordService:
    def __init__(
        self,
        connection: HotwordConnection,
        client_factory=None,
    ) -> None:
        self._connection = connection
        self._http_url = _http_url(connection)
        self._client_factory = client_factory or _build_vocabulary_client
        self._client: VocabularyClient | None = None

    def execute(self, request: dict[str, Any]) -> Any:
        action = request.get('action')
        if action == 'list':
            prefix = _validate_prefix(request.get('prefix', ''), True)
            page_index = _validate_integer(
                request.get('pageIndex'), 0, 100000
            )
            page_size = _validate_integer(request.get('pageSize'), 1, 50)
            resources = self._get_client().list_vocabularies(
                prefix=prefix or None,
                page_index=page_index,
                page_size=page_size,
            )
            return [_normalize_summary(item) for item in resources]
        if action == 'query':
            vocabulary_id = _validate_vocabulary_id(
                request.get('vocabularyId')
            )
            return self._query(vocabulary_id)
        if action == 'create':
            prefix = _validate_prefix(request.get('prefix'), False)
            vocabulary = _validate_vocabulary(request.get('vocabulary'))
            vocabulary_id = self._get_client().create_vocabulary(
                target_model=self._connection.model,
                prefix=prefix,
                vocabulary=vocabulary,
            )
            return {
                'vocabularyId': vocabulary_id,
                'targetModel': self._connection.model,
            }
        if action == 'update':
            vocabulary_id = _validate_vocabulary_id(
                request.get('vocabularyId')
            )
            vocabulary = _validate_vocabulary(request.get('vocabulary'))
            self._require_current_model(vocabulary_id)
            self._get_client().update_vocabulary(vocabulary_id, vocabulary)
            return {'vocabularyId': vocabulary_id}
        if action == 'delete':
            vocabulary_id = _validate_vocabulary_id(
                request.get('vocabularyId')
            )
            self._require_current_model(vocabulary_id)
            self._get_client().delete_vocabulary(vocabulary_id)
            return {'vocabularyId': vocabulary_id}
        raise ValueError('Invalid hotword action')

    def _get_client(self) -> VocabularyClient:
        if self._client is None:
            self._client = self._client_factory(
                self._connection,
                self._http_url,
            )
        return self._client

    def _query(self, vocabulary_id: str) -> dict[str, Any]:
        resource = self._get_client().query_vocabulary(vocabulary_id)
        return _normalize_resource(vocabulary_id, resource)

    def _require_current_model(self, vocabulary_id: str) -> None:
        resource = self._query(vocabulary_id)
        if resource['targetModel'] != self._connection.model:
            raise HotwordModelMismatchError('Hotword target model mismatch')


def _build_vocabulary_client(
    connection: HotwordConnection,
    http_url: str,
) -> VocabularyClient:
    import dashscope
    from dashscope.audio.asr import VocabularyService

    if connection.api_key:
        dashscope.api_key = connection.api_key
    dashscope.base_http_api_url = http_url
    return VocabularyService(
        api_key=connection.api_key or None,
        workspace=connection.workspace_id,
        model=connection.model,
    )


def run_hotword_worker(
    input_stream: TextIO,
    output_stream: TextIO,
    diagnostic_stream: TextIO | None = None,
) -> int:
    diagnostic_stream = diagnostic_stream or sys.stderr
    connection: HotwordConnection | None = None
    try:
        payload = input_stream.read(1_048_577)
        if len(payload) > 1_048_576:
            raise ValueError('Hotword request envelope is too large')
        envelope = json.loads(payload)
        if not isinstance(envelope, dict):
            raise ValueError('Invalid hotword request envelope')
        connection = HotwordConnection(
            workspace_id=_validate_workspace(envelope.get('workspaceId')),
            websocket_url=_validate_text(
                envelope.get('websocketUrl'), 4096
            ),
            model=_validate_model(envelope.get('model')),
            api_key=_validate_text(envelope.get('apiKey'), 8192, True),
        )
        request = envelope.get('request')
        if not isinstance(request, dict):
            raise ValueError('Invalid hotword request')
        result = HotwordService(connection).execute(request)
        response = {'ok': True, 'data': result}
    except HotwordModelMismatchError as error:
        _write_worker_diagnostic(error, connection, diagnostic_stream)
        response = {'ok': False, 'errorCode': 'model_mismatch'}
    except (TypeError, ValueError, json.JSONDecodeError) as error:
        _write_worker_diagnostic(error, connection, diagnostic_stream)
        response = {'ok': False, 'errorCode': 'invalid_request'}
    except Exception as error:
        _write_worker_diagnostic(error, connection, diagnostic_stream)
        response = {'ok': False, 'errorCode': 'sdk_error'}
    output_stream.write(json.dumps(response, ensure_ascii=False) + '\n')
    output_stream.flush()
    return 0 if response['ok'] else 1


def _write_worker_diagnostic(
    error: Exception,
    connection: HotwordConnection | None,
    output: TextIO,
) -> None:
    details = exception_diagnostic(
        error,
        operation='fun_asr.hotword.worker',
        secrets=((connection.api_key,) if connection is not None else ()),
    )
    output.write(json.dumps({
        'source': 'hotword-worker',
        'diagnostic': details,
    }, ensure_ascii=False) + '\n')
    output.flush()


def _http_url(connection: HotwordConnection) -> str:
    endpoint = urlparse(connection.websocket_url)
    expected_hosts = {
        f'{connection.workspace_id}.cn-beijing.maas.aliyuncs.com'.lower(),
        f'{connection.workspace_id}.ap-southeast-1.maas.aliyuncs.com'.lower(),
    }
    if (
        endpoint.scheme != 'wss'
        or (endpoint.hostname or '').lower() not in expected_hosts
        or endpoint.path != '/api-ws/v1/inference'
        or endpoint.query
        or endpoint.fragment
    ):
        raise ValueError('Invalid hotword endpoint')
    return f'https://{endpoint.hostname}/api/v1'


def _normalize_summary(item: dict[str, Any]) -> dict[str, Any]:
    return {
        'vocabularyId': _validate_vocabulary_id(item.get('vocabulary_id')),
        'status': _validate_text(item.get('status', ''), 64, True),
        'createdAt': _validate_text(item.get('gmt_create', ''), 128, True),
        'modifiedAt': _validate_text(item.get('gmt_modified', ''), 128, True),
    }


def _normalize_resource(
    vocabulary_id: str,
    item: dict[str, Any],
) -> dict[str, Any]:
    summary = _normalize_summary({
        **item,
        'vocabulary_id': vocabulary_id,
    })
    return {
        **summary,
        'targetModel': _validate_model(item.get('target_model')),
        'vocabulary': _validate_vocabulary(item.get('vocabulary')),
    }


def _validate_vocabulary(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not 1 <= len(value) <= 2000:
        raise ValueError('Invalid vocabulary')
    result = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Invalid vocabulary entry')
        text = _validate_text(item.get('text'), 100)
        if text in seen:
            raise ValueError('Duplicate vocabulary entry')
        seen.add(text)
        if any(ord(character) > 127 for character in text):
            if len(text) > 15:
                raise ValueError('Hotword text is too long')
        elif len(text.split()) > 7:
            raise ValueError('Hotword text has too many segments')
        weight = _validate_integer(item.get('weight'), 1, 5)
        lang = item.get('lang')
        if lang not in (None, '', *SUPPORTED_HOTWORD_LANGUAGES):
            raise ValueError('Invalid hotword language')
        result.append({
            'text': text,
            'weight': weight,
            **({'lang': lang} if lang else {}),
        })
    return result


def _validate_context_terms(value: tuple[str, ...]) -> tuple[str, ...]:
    if len(value) > 100:
        raise ValueError('Too many context terms')
    terms = tuple(_validate_text(term, 100) for term in value)
    if len(set(terms)) != len(terms) or len('\n'.join(terms)) > 400:
        raise ValueError('Invalid context terms')
    return terms


def _validate_prefix(value: Any, allow_empty: bool) -> str:
    prefix = _validate_text(value, 10, allow_empty)
    if prefix and not re.fullmatch(r'[a-z0-9]+', prefix):
        raise ValueError('Invalid hotword prefix')
    return prefix


def _validate_vocabulary_id(value: Any) -> str:
    vocabulary_id = _validate_text(value, 256)
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', vocabulary_id):
        raise ValueError('Invalid vocabulary ID')
    return vocabulary_id


def _validate_workspace(value: Any) -> str:
    workspace = _validate_text(value, 256)
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', workspace):
        raise ValueError('Invalid Workspace ID')
    return workspace


def _validate_model(value: Any) -> str:
    model = _validate_text(value, 128)
    if model not in SUPPORTED_FUN_ASR_MODELS:
        raise ValueError('Invalid Fun-ASR model')
    return model


def _validate_text(value: Any, maximum: int, allow_empty=False) -> str:
    if not isinstance(value, str):
        raise ValueError('Invalid text')
    text = value.strip()
    if (not allow_empty and not text) or len(text) > maximum:
        raise ValueError('Invalid text')
    return text


def _validate_integer(value: Any, minimum: int, maximum: int) -> int:
    if (
        not isinstance(value, int)
        or isinstance(value, bool)
        or not minimum <= value <= maximum
    ):
        raise ValueError('Invalid integer')
    return value
