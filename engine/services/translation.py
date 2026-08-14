from collections.abc import Callable

from core import CaptionFinal
from core.worker import BoundedWorkerPool


class NoTranslationService:
    def submit(self, caption: CaptionFinal) -> None:
        return

    def close(self) -> None:
        return


class QueuedTranslationService:
    """Run translations on bounded daemon workers instead of per-caption threads."""

    def __init__(
        self,
        translator: Callable[[CaptionFinal], None],
        warning_handler: Callable[[str], None],
        worker_count: int = 2,
        max_pending: int = 32,
    ) -> None:
        if worker_count <= 0:
            raise ValueError('worker_count must be positive')
        if max_pending <= 0:
            raise ValueError('max_pending must be positive')
        self._translator = translator
        self._warning_handler = warning_handler
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

    def _translate(self, caption: CaptionFinal) -> None:
        try:
            self._translator(caption)
        except Exception as error:
            self._warning_handler(
                f'Translation failed ({type(error).__name__})'
            )


def build_legacy_translation_service(
    target: str | None,
    trans_model: str,
    model_name: str,
    url: str,
    api_key: str,
    warning_handler: Callable[[str], None],
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

    return QueuedTranslationService(translate, warning_handler)
