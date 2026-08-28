from dataclasses import dataclass


@dataclass(frozen=True)
class TranslationRequest:
    caption_id: int
    source_language: str
    target_language: str
    text: str
    started_at: str


@dataclass(frozen=True)
class TranslationResult:
    caption_id: int
    source_text: str
    translated_text: str
    started_at: str
    provider: str
    target_language: str
