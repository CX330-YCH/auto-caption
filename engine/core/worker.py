import threading
import time
from collections.abc import Callable
from queue import Empty, Full, Queue


class BoundedWorkerPool:
    """Small bounded daemon pool for provider and service background work."""

    def __init__(self, worker_count: int, max_pending: int) -> None:
        if worker_count <= 0:
            raise ValueError('worker_count must be positive')
        if max_pending <= 0:
            raise ValueError('max_pending must be positive')
        self._tasks: Queue[Callable[[], None]] = Queue(maxsize=max_pending)
        self._condition = threading.Condition()
        self._pending_count = 0
        self._closed = False
        self._workers = [
            threading.Thread(target=self._run, daemon=True)
            for _ in range(worker_count)
        ]
        for worker in self._workers:
            worker.start()

    def submit(self, task: Callable[[], None]) -> bool:
        with self._condition:
            if self._closed:
                return False
            self._pending_count += 1
        try:
            self._tasks.put_nowait(task)
            return True
        except Full:
            with self._condition:
                self._pending_count -= 1
                self._condition.notify_all()
            return False

    def close(
        self,
        *,
        cancel_pending: bool,
        wait_timeout: float,
    ) -> bool:
        if wait_timeout < 0:
            raise ValueError('wait_timeout must not be negative')
        with self._condition:
            self._closed = True
        if cancel_pending:
            self._cancel_queued_tasks()
        return self._wait_for_completion(wait_timeout)

    def _cancel_queued_tasks(self) -> None:
        cancelled = 0
        while True:
            try:
                self._tasks.get_nowait()
            except Empty:
                break
            else:
                cancelled += 1
                self._tasks.task_done()
        if cancelled:
            with self._condition:
                self._pending_count -= cancelled
                self._condition.notify_all()

    def _wait_for_completion(self, timeout: float) -> bool:
        deadline = time.monotonic() + timeout
        with self._condition:
            while self._pending_count:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                self._condition.wait(remaining)
            return True

    def _run(self) -> None:
        while True:
            try:
                task = self._tasks.get(timeout=0.1)
            except Empty:
                with self._condition:
                    if self._closed and self._pending_count == 0:
                        return
                continue
            try:
                task()
            finally:
                self._tasks.task_done()
                with self._condition:
                    self._pending_count -= 1
                    self._condition.notify_all()
