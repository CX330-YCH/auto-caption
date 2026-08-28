from ..models import TranslationRequest, TranslationResult
from ..provider import TranslationProvider


LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'zh-cn': 'Chinese',
}


class OllamaTranslationProvider(TranslationProvider):
    def __init__(
        self,
        model: str,
        url: str = '',
        api_key: str = '',
    ) -> None:
        self._model = model
        self._url = url
        self._api_key = api_key

    @property
    def name(self) -> str:
        return 'ollama'

    @property
    def secrets(self) -> tuple[str, ...]:
        return (self._api_key,)

    def translate(self, request: TranslationRequest) -> TranslationResult:
        content = self._request_translation(request)
        if content.startswith('<think>'):
            index = content.find('</think>')
            if index != -1:
                content = content[index + 8:]
        return TranslationResult(
            caption_id=request.caption_id,
            source_text=request.text,
            translated_text=content.strip(),
            started_at=request.started_at,
            provider=self.name,
            target_language=request.target_language,
        )

    def _request_translation(self, request: TranslationRequest) -> str:
        target_name = LANGUAGE_NAMES[request.target_language]
        messages = [
            {
                'role': 'system',
                'content': (
                    '/no_think Translate the following content into '
                    f'{target_name}, and do not output any additional '
                    'information.'
                ),
            },
            {'role': 'user', 'content': request.text},
        ]
        if self._url:
            try:
                from openai import OpenAI
            except ImportError:
                OpenAI = None
            if OpenAI:
                client = OpenAI(
                    base_url=self._url,
                    api_key=self._api_key or 'ollama',
                )
                response = client.chat.completions.create(
                    model=self._model,
                    messages=messages,
                )
                return response.choices[0].message.content or ''

            from ollama import Client

            response = Client(host=self._url).chat(
                model=self._model,
                messages=messages,
            )
            return response.message.content or ''

        from ollama import chat

        response = chat(model=self._model, messages=messages)
        return response.message.content or ''
