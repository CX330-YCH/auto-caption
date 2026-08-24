from __future__ import annotations

import json
import logging
import sys
import threading
import warnings
from collections.abc import Callable

from .diagnostics import exception_diagnostic, safe_diagnostic_value


def install_runtime_diagnostics(
    is_debug_enabled: Callable[[], bool],
) -> None:
    """Capture Python runtime failures without changing stdout protocol."""

    from utils.sysout import stderr

    def emit(event: str, fields: dict[str, object]) -> None:
        stderr(json.dumps({
            'source': 'python-runtime',
            'event': event,
            'thread': threading.current_thread().name,
            'fields': fields,
        }, ensure_ascii=False))

    original_excepthook = sys.excepthook

    def excepthook(error_type, error, traceback_value) -> None:
        emit('uncaught-exception', exception_diagnostic(
            error,
            operation='python.excepthook',
        ))
        original_excepthook(error_type, error, traceback_value)

    sys.excepthook = excepthook
    original_thread_excepthook = threading.excepthook

    def thread_excepthook(args: threading.ExceptHookArgs) -> None:
        emit('thread-exception', exception_diagnostic(
            args.exc_value,
            operation='python.threading.excepthook',
        ))
        original_thread_excepthook(args)

    threading.excepthook = thread_excepthook
    original_unraisablehook = sys.unraisablehook

    def unraisablehook(args: sys.UnraisableHookArgs) -> None:
        emit('unraisable-exception', {
            **exception_diagnostic(
                args.exc_value,
                operation='python.unraisablehook',
            ),
            'object': safe_diagnostic_value(args.object),
            'errorMessage': args.err_msg or '',
        })
        original_unraisablehook(args)

    sys.unraisablehook = unraisablehook
    original_showwarning = warnings.showwarning

    def showwarning(message, category, filename, lineno, file=None, line=None):
        if is_debug_enabled():
            emit('warning', {
                'message': str(message),
                'category': category.__name__,
                'filename': filename,
                'lineno': lineno,
                'line': line or '',
            })
        original_showwarning(message, category, filename, lineno, file, line)

    warnings.showwarning = showwarning

    class DiagnosticLogHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            if not is_debug_enabled():
                return
            try:
                fields: dict[str, object] = {
                    'logger': record.name,
                    'level': record.levelname,
                    'message': self.format(record),
                    'module': record.module,
                    'function': record.funcName,
                    'lineno': record.lineno,
                }
                if record.exc_info and record.exc_info[1] is not None:
                    fields['exception'] = exception_diagnostic(
                        record.exc_info[1],
                        operation='python.logging',
                    )
                emit('logging', fields)
            except Exception:
                self.handleError(record)

    logging.getLogger().addHandler(DiagnosticLogHandler())
