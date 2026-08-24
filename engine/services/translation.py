from collections.abc import Callable

from core import CaptionFinal
from core import exception_diagnostic
from core.worker import BoundedWorkerPool


class NoTranslationService:
    def submit(self, caption: CaptionFinal) -> None:
        return

    def close(self) -> None:
        return

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {'enabled': False}


class QueuedTranslationService:
    """Run translations on bounded daemon workers instead of per-caption threads."""

    def __init__(
        self,
        translator: Callable[[CaptionFinal], None],
        warning_handler: Callable[[str], None],
        diagnostic_handler: Callable[
            [str, dict[str, object]], None
        ] | None = None,
        secrets: tuple[str, ...] = (),
        worker_count: int = 2,
        max_pending: int = 32,
    ) -> None:
        if worker_count <= 0:
            raise ValueError('worker_count must be positive')
        if max_pending <= 0:
            raise ValueError('max_pending must be positive')
        self._translator = translator
        self._warning_handler = warning_handler
        self._diagnostic_handler = diagnostic_handler or (
            lambda message, details: None
        )
        self._secrets = secrets
        self._workers = BoundedWorkerPool(worker_count, max_pending)
        self._closed = False

    def submit(self, caption: CaptionFinal) -> None:
        if self._closed:
            return
        if not self._workers.submit(lambda: self._translate(caption)):
            self._warning_handler(
                'Translation queue is full; the newest caption was skipped.'
            )

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._workers.close(cancel_pending=False, wait_timeout=0)

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {'enabled': True, **self._workers.snapshot()}

    def _translate(self, caption: CaptionFinal) -> None:
        try:
            self._translator(caption)
        except Exception as error:
            self._warning_handler(
                f'Translation failed ({type(error).__name__})'
            )
            self._diagnostic_handler(
                'Translation request failed.',
                exception_diagnostic(
                    error,
                    operation='translation.request',
                    secrets=self._secrets,
                ),
            )


def build_legacy_translation_service(
    target: str | None,
    trans_model: str,
    model_name: str,
    url: str,
    api_key: str,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[
        [str, dict[str, object]], None
    ] | None = None,
):
    if not target:
        return NoTranslationService()

    from utils.translation import google_translate, ollama_translate

    if trans_model == 'google':
        def translate(caption: CaptionFinal) -> None:
            google_translate(
                model_name,
                target,
                caption.text,
                caption.started_at,
                caption.caption_id,
            )
    else:
        def translate(caption: CaptionFinal) -> None:
            ollama_translate(
                model_name,
                target,
                caption.text,
                caption.started_at,
                caption.caption_id,
                url,
                api_key,
            )

    return QueuedTranslationService(
        translate,
        warning_handler,
        diagnostic_handler=diagnostic_handler,
        secrets=(api_key,),
    )
