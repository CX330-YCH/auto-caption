from abc import ABC, abstractmethod

from .models import TranslationRequest, TranslationResult


class TranslationProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @property
    def secrets(self) -> tuple[str, ...]:
        return ()

    def start(self) -> None:
        return

    @abstractmethod
    def translate(self, request: TranslationRequest) -> TranslationResult:
        raise NotImplementedError

    def stop(self) -> None:
        return

    def diagnostic_snapshot(self) -> dict[str, object]:
        return {'provider': self.name}
