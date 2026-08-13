from dataclasses import dataclass
from typing import TypeAlias


@dataclass(frozen=True)
class CaptionPartial:
    caption_id: int
    started_at: str
    ended_at: str
    text: str
    translation: str = ''


@dataclass(frozen=True)
class CaptionFinal:
    caption_id: int
    started_at: str
    ended_at: str
    text: str
    translation: str = ''


@dataclass(frozen=True)
class ProviderReady:
    provider: str
    message: str


@dataclass(frozen=True)
class ProviderInfo:
    provider: str
    message: str


@dataclass(frozen=True)
class ProviderDebug:
    provider: str
    message: str
    details: dict[str, object] | None = None


@dataclass(frozen=True)
class ProviderStopped:
    provider: str
    message: str


@dataclass(frozen=True)
class ProviderError:
    provider: str
    message: str
    fatal: bool = True
    details: dict[str, object] | None = None


@dataclass(frozen=True)
class UsageUpdated:
    provider: str
    value: int | float
    unit: str = ''


RecognitionEvent: TypeAlias = (
    CaptionPartial
    | CaptionFinal
    | ProviderReady
    | ProviderInfo
    | ProviderDebug
    | ProviderStopped
    | ProviderError
    | UsageUpdated
)
