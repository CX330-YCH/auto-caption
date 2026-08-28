import asyncio

from ..models import TranslationRequest, TranslationResult
from ..provider import TranslationProvider


class GoogleTranslationProvider(TranslationProvider):
    @property
    def name(self) -> str:
        return 'google'

    def translate(self, request: TranslationRequest) -> TranslationResult:
        from googletrans import Translator

        translator = Translator()
        response = asyncio.run(translator.translate(
            request.text,
            dest=request.target_language,
        ))
        return TranslationResult(
            caption_id=request.caption_id,
            source_text=request.text,
            translated_text=response.text,
            started_at=request.started_at,
            provider=self.name,
            target_language=request.target_language,
        )
