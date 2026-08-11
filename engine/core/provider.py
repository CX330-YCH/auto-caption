from abc import ABC, abstractmethod
from queue import Empty, Queue

from .audio import AudioFrame
from .events import RecognitionEvent


class RecognitionProvider(ABC):
    """Provider boundary: start -> accept_audio(frame)* -> stop."""

    def __init__(self) -> None:
        self._events: Queue[RecognitionEvent] = Queue()

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

    def _emit(self, event: RecognitionEvent) -> None:
        self._events.put(event)
