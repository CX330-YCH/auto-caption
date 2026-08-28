from collections.abc import Callable
from typing import Any
import base64
import hashlib
import json
import uuid

from core import (
    CaptionFinal,
    CaptionPartial,
    CaptionRevoked,
    ProviderError,
    ProviderDebug,
    ProviderMetric,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    RecognitionEvent,
    UsageUpdated,
)
from translation import TranslationResult


MAX_DIAGNOSTIC_BYTES = 32 * 1024 * 1024


class ProtocolEventSink:
    """Map internal recognition events onto the existing command protocol."""

    def __init__(
        self,
        command_writer: Callable[[str, str], None] | None = None,
        object_writer: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        if command_writer is None or object_writer is None:
            from utils.sysout import stdout_cmd, stdout_obj

            command_writer = command_writer or stdout_cmd
            object_writer = object_writer or stdout_obj
        self._command_writer = command_writer
        self._object_writer = object_writer

    def publish(self, event: RecognitionEvent) -> None:
        if isinstance(event, (CaptionPartial, CaptionFinal)):
            self._object_writer({
                'command': 'caption',
                'event_version': 1,
                'phase': (
                    'partial' if isinstance(event, CaptionPartial) else 'final'
                ),
                'index': event.caption_id,
                'time_s': event.started_at,
                'time_t': event.ended_at,
                'text': event.text,
                'translation': event.translation,
            })
        elif isinstance(event, CaptionRevoked):
            self._object_writer({
                'command': 'caption_remove',
                'event_version': 1,
                'index': event.caption_id,
            })
        elif isinstance(event, (ProviderReady, ProviderInfo, ProviderStopped)):
            self._command_writer('info', event.message)
        elif isinstance(event, ProviderDebug):
            self._object_writer({
                'command': 'debug',
                'content': event.message,
                'details': event.details or {},
            })
        elif isinstance(event, ProviderMetric):
            self._object_writer({
                'command': 'metric',
                'event_version': 1,
                'provider': event.provider,
                'category': event.category,
                'name': event.name,
                'fields': event.fields,
            })
        elif isinstance(event, ProviderError):
            if event.details:
                self._write_error_diagnostic(event)
            else:
                self._command_writer('error', event.message)
        elif isinstance(event, UsageUpdated):
            content = f'{event.value} {event.unit}'.strip()
            self._command_writer('usage', content)

    def warning(self, message: str) -> None:
        self._command_writer('warn', message)

    def publish_translation(self, result: TranslationResult) -> None:
        self._object_writer({
            'command': 'translation',
            'caption_id': result.caption_id,
            'time_s': result.started_at,
            'text': result.source_text,
            'translation': result.translated_text,
        })

    def _write_error_diagnostic(self, event: ProviderError) -> None:
        diagnostic = {
            'version': 1,
            **(event.details or {}),
        }
        payload = json.dumps(
            diagnostic,
            ensure_ascii=False,
            separators=(',', ':'),
        ).encode('utf-8')
        if len(payload) > MAX_DIAGNOSTIC_BYTES:
            diagnostic = {
                'version': 1,
                'diagnostic_truncated': True,
                'reason': 'serialized diagnostic exceeded 32 MiB safety limit',
                'original_bytes': len(payload),
            }
            payload = json.dumps(
                diagnostic,
                ensure_ascii=False,
                separators=(',', ':'),
            ).encode('utf-8')
        if len(payload) <= 512 * 1024:
            self._object_writer({
                'command': 'error',
                'content': event.message,
                'diagnostic': diagnostic,
            })
            return

        diagnostic_id = str(uuid.uuid4())
        encoded = base64.b64encode(payload).decode('ascii')
        chunk_size = 192 * 1024
        chunks = [
            encoded[index:index + chunk_size]
            for index in range(0, len(encoded), chunk_size)
        ]
        for index, chunk in enumerate(chunks):
            self._object_writer({
                'command': 'diagnostic_chunk',
                'event_version': 1,
                'id': diagnostic_id,
                'index': index,
                'count': len(chunks),
                'content': chunk,
            })
        self._object_writer({
            'command': 'error',
            'content': event.message,
            'diagnostic_ref': {
                'version': 1,
                'id': diagnostic_id,
                'bytes': len(payload),
                'sha256': hashlib.sha256(payload).hexdigest(),
            },
        })
