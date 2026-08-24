from abc import ABC, abstractmethod
from collections.abc import Callable
from queue import Empty, Full, Queue

from .audio import AudioFrame
from .events import RecognitionEvent


class RecognitionProvider(ABC):
    """Provider boundary: start -> accept_audio(frame)* -> stop."""

    def __init__(self, max_pending_events: int = 256) -> None:
        if max_pending_events <= 0:
            raise ValueError('max_pending_events must be positive')
        self._events: Queue[RecognitionEvent] = Queue(
            maxsize=max_pending_events
        )
        self._metric_handler: Callable[
            [str, str, dict[str, object]], None
        ] = lambda category, name, fields: None
        self._debug_enabled: Callable[[], bool] = lambda: False
        self._event_high_water = 0

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def start(self) -> None: ...

    @abstractmethod
    def accept_audio(self, frame: AudioFrame) -> None: ...

    @abstractmethod
    def stop(self) -> None: ...

    def drain_events(self) -> list[RecognitionEvent]:
        events: list[RecognitionEvent] = []
        while True:
            try:
                events.append(self._events.get_nowait())
            except Empty:
                return events

    def set_metric_handler(
        self,
        handler: Callable[[str, str, dict[str, object]], None],
    ) -> None:
        self._metric_handler = handler

    def set_debug_enabled(self, handler: Callable[[], bool]) -> None:
        self._debug_enabled = handler

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {
            'provider': self.name,
            'eventQueueDepth': self._events.qsize(),
            'eventQueueCapacity': self._events.maxsize,
            'eventQueueHighWater': self._event_high_water,
        }

    def _emit(self, event: RecognitionEvent) -> None:
        try:
            self._events.put(event, timeout=0.5)
            self._event_high_water = max(
                self._event_high_water,
                self._events.qsize(),
            )
            self._metric_handler(
                'provider.events',
                'event.enqueued',
                {
                    'provider': self.name,
                    'eventType': type(event).__name__,
                    'queueDepth': self._events.qsize(),
                    'queueCapacity': self._events.maxsize,
                    'queueHighWater': self._event_high_water,
                },
            )
        except Full as error:
            raise RuntimeError('Provider event queue is full') from error
