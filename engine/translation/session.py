from collections.abc import Callable
import threading

from core import CaptionFinal, exception_diagnostic
from core.worker import BoundedWorkerPool

from .models import TranslationRequest, TranslationResult
from .provider import TranslationProvider


class NoTranslationSession:
    def start(self) -> None:
        return

    def submit(self, caption: CaptionFinal) -> None:
        return

    def close(self) -> None:
        return

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {'enabled': False}


class TranslationSession:
    """Own bounded translation work independently from recognition."""

    def __init__(
        self,
        provider: TranslationProvider,
        source_language: str,
        target_language: str,
        result_handler: Callable[[TranslationResult], None],
        warning_handler: Callable[[str], None],
        diagnostic_handler: Callable[
            [str, dict[str, object]], None
        ] | None = None,
        worker_count: int = 2,
        max_pending: int = 32,
    ) -> None:
        if worker_count <= 0:
            raise ValueError('worker_count must be positive')
        if max_pending <= 0:
            raise ValueError('max_pending must be positive')
        self._provider = provider
        self._source_language = source_language
        self._target_language = target_language
        self._result_handler = result_handler
        self._warning_handler = warning_handler
        self._diagnostic_handler = diagnostic_handler or (
            lambda message, details: None
        )
        self._workers = BoundedWorkerPool(worker_count, max_pending)
        self._started = False
        self._closed = False
        self._lifecycle_lock = threading.Lock()

    def start(self) -> None:
        with self._lifecycle_lock:
            if self._started or self._closed:
                return
            self._provider.start()
            self._started = True

    def submit(self, caption: CaptionFinal) -> None:
        if self._closed:
            return
        if not self._started:
            raise RuntimeError('Translation session is not started')
        request = TranslationRequest(
            caption_id=caption.caption_id,
            source_language=self._source_language,
            target_language=self._target_language,
            text=caption.text,
            started_at=caption.started_at,
        )
        if not self._workers.submit(lambda: self._translate(request)):
            self._warning_handler(
                'Translation queue is full; the newest caption was skipped.'
            )

    def close(self) -> None:
        with self._lifecycle_lock:
            if self._closed:
                return
            self._closed = True
        self._workers.close(cancel_pending=False, wait_timeout=0)
        self._provider.stop()

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {
            'enabled': True,
            'provider': self._provider.name,
            **self._workers.snapshot(),
            'providerState': self._provider.diagnostic_snapshot(),
        }

    def _translate(self, request: TranslationRequest) -> None:
        try:
            result = self._provider.translate(request)
            self._result_handler(result)
        except Exception as error:
            self._warning_handler(
                f'Translation failed ({type(error).__name__})'
            )
            self._diagnostic_handler(
                'Translation request failed.',
                exception_diagnostic(
                    error,
                    operation='translation.request',
                    secrets=self._provider.secrets,
                ),
            )
