from collections.abc import Callable
from typing import Any

from core import (
    CaptionFinal,
    CaptionPartial,
    CaptionRevoked,
    ProviderError,
    ProviderDebug,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    RecognitionEvent,
    UsageUpdated,
)


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
        elif isinstance(event, ProviderError):
            if event.details:
                self._object_writer({
                    'command': 'error',
                    'content': event.message,
                    'diagnostic': {
                        'version': 1,
                        **event.details,
                    },
                })
            else:
                self._command_writer('error', event.message)
        elif isinstance(event, UsageUpdated):
            content = f'{event.value} {event.unit}'.strip()
            self._command_writer('usage', content)

    def warning(self, message: str) -> None:
        self._command_writer('warn', message)
