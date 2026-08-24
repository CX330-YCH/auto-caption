from __future__ import annotations

import threading
from collections.abc import Callable
from queue import Queue
from typing import Protocol

from .audio import AudioFrame


class SnapshotSource(Protocol):
    def diagnostic_snapshot(self) -> dict[str, object]: ...


class RuntimeTelemetry:
    """Publish bounded periodic snapshots while Debug Mode is enabled."""

    def __init__(
        self,
        *,
        audio_queue: Queue[AudioFrame],
        provider: SnapshotSource,
        translation_service: object,
        emit: Callable[[str, str, dict[str, object]], None],
        is_running: Callable[[], bool],
        is_enabled: Callable[[], bool],
        interval_seconds: float = 1.0,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError('telemetry interval must be positive')
        self._audio_queue = audio_queue
        self._provider = provider
        self._translation_service = translation_service
        self._emit = emit
        self._is_running = is_running
        self._is_enabled = is_enabled
        self._interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._run,
            name='debug-telemetry',
            daemon=True,
        )

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=self._interval_seconds + 0.5)

    def _run(self) -> None:
        while self._is_running() and not self._stop_event.is_set():
            if self._is_enabled():
                self._emit('audio.queue', 'snapshot', {
                    'depth': self._audio_queue.qsize(),
                    'capacity': self._audio_queue.maxsize,
                })
                self._emit(
                    'recognition.provider',
                    'snapshot',
                    self._provider.diagnostic_snapshot(),
                )
                snapshot = getattr(
                    self._translation_service,
                    'diagnostic_snapshot',
                    None,
                )
                if callable(snapshot):
                    self._emit(
                        'translation.queue',
                        'snapshot',
                        snapshot(),
                    )
            self._stop_event.wait(self._interval_seconds)
