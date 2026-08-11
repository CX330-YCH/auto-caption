import threading
from collections.abc import Callable
from queue import Empty, Full, Queue

from core import CaptionFinal


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
        self._tasks: Queue[CaptionFinal | None] = Queue(maxsize=max_pending)
        self._closed = False
        self._workers = [
            threading.Thread(target=self._run, daemon=True)
            for _ in range(worker_count)
        ]
        for worker in self._workers:
            worker.start()

    def submit(self, caption: CaptionFinal) -> None:
        if self._closed:
            return
        try:
            self._tasks.put_nowait(caption)
        except Full:
            self._warning_handler(
                'Translation queue is full; the newest caption was skipped.'
            )

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        for _ in self._workers:
            try:
                self._tasks.put_nowait(None)
            except Full:
                break

    def _run(self) -> None:
        while True:
            try:
                caption = self._tasks.get(timeout=0.1)
            except Empty:
                if self._closed:
                    return
                continue
            if caption is None:
                return
            try:
                self._translator(caption)
            except Exception as error:
                self._warning_handler(
                    f'Translation failed ({type(error).__name__})'
                )
            finally:
                self._tasks.task_done()


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
            )
    else:
        def translate(caption: CaptionFinal) -> None:
            ollama_translate(
                model_name,
                target,
                caption.text,
                caption.started_at,
                url,
                api_key,
            )

    return QueuedTranslationService(translate, warning_handler)
