from collections.abc import Callable
from dataclasses import dataclass, field

from .provider import TranslationProvider
from .providers import GoogleTranslationProvider, OllamaTranslationProvider


@dataclass(frozen=True)
class TranslationProviderConfig:
    name: str
    model: str = ''
    url: str = ''
    api_key: str = field(default='', repr=False)


TranslationProviderBuilder = Callable[
    [TranslationProviderConfig],
    TranslationProvider,
]


class TranslationProviderRegistry:
    def __init__(self) -> None:
        self._builders: dict[str, TranslationProviderBuilder] = {}

    def register(
        self,
        name: str,
        builder: TranslationProviderBuilder,
    ) -> None:
        if not name or name in self._builders:
            raise ValueError(
                f'Translation Provider is already registered: {name}'
            )
        self._builders[name] = builder

    def create(
        self,
        config: TranslationProviderConfig,
    ) -> TranslationProvider:
        try:
            builder = self._builders[config.name]
        except KeyError as error:
            raise ValueError(
                'Invalid translation engine specified.'
            ) from error
        return builder(config)

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(self._builders)


def build_translation_provider_registry() -> TranslationProviderRegistry:
    registry = TranslationProviderRegistry()
    registry.register(
        'google',
        lambda config: GoogleTranslationProvider(),
    )
    registry.register(
        'ollama',
        lambda config: OllamaTranslationProvider(
            model=config.model,
            url=config.url,
            api_key=config.api_key,
        ),
    )
    return registry
