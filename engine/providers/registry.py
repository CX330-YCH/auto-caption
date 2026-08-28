from collections.abc import Callable
from dataclasses import dataclass, field

from core import (
    AudioPipeline,
    AudioSource,
    RecognitionProvider,
)
from services import (
    HotwordRuntimeConfig,
)

from .glm import GlmProvider
from .gummy import GummyProvider
from .fun_asr import FunAsrClientOptions, FunAsrProvider
from .sosv import SosvProvider
from .vosk import VoskProvider
from .apple_speech import AppleSpeechProvider


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    source_language: str
    target_language: str
    gummy_api_key: str = field(repr=False)
    vosk_model_path: str
    sosv_model_path: str | None
    glm_url: str
    glm_model: str
    glm_api_key: str = field(repr=False)
    fun_asr_model: str
    fun_asr_url: str
    fun_asr_workspace: str
    fun_asr_api_key: str = field(repr=False)
    fun_asr_semantic_punctuation: bool
    fun_asr_max_sentence_silence: int
    fun_asr_heartbeat: bool
    fun_asr_vocabulary_id: str
    fun_asr_vocabulary_model: str
    fun_asr_context_terms: tuple[str, ...]
    apple_speech_helper: str = ''


@dataclass(frozen=True)
class ProviderRuntime:
    provider: RecognitionProvider
    audio_pipeline: AudioPipeline
    external_translation: bool = True


ProviderBuilder = Callable[
    [
        ProviderConfig,
        AudioSource,
        Callable[[str], None],
        Callable[[str, dict[str, object]], None],
    ],
    ProviderRuntime,
]


class ProviderRegistry:
    def __init__(self) -> None:
        self._builders: dict[str, ProviderBuilder] = {}

    def register(self, name: str, builder: ProviderBuilder) -> None:
        if not name or name in self._builders:
            raise ValueError(f'Provider is already registered: {name}')
        self._builders[name] = builder

    def create(
        self,
        config: ProviderConfig,
        audio_source: AudioSource,
        warning_handler: Callable[[str], None],
        diagnostic_handler: Callable[
            [str, dict[str, object]], None
        ] | None = None,
    ) -> ProviderRuntime:
        try:
            builder = self._builders[config.name]
        except KeyError as error:
            raise ValueError('Invalid caption engine specified.') from error
        return builder(
            config,
            audio_source,
            warning_handler,
            diagnostic_handler or (lambda message, details: None),
        )

    @property
    def names(self) -> tuple[str, ...]:
        return tuple(self._builders)


def build_provider_registry() -> ProviderRegistry:
    registry = ProviderRegistry()
    registry.register('gummy', _build_gummy)
    registry.register('vosk', _build_vosk)
    registry.register('sosv', _build_sosv)
    registry.register('glm', _build_glm)
    registry.register('fun_asr', _build_fun_asr)
    registry.register('apple_speech', _build_apple_speech)
    return registry


def _build_gummy(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    from utils.audioprcs import merge_chunk_channels

    target = _target(config.target_language)
    return ProviderRuntime(
        provider=GummyProvider(
            audio_source.RATE,
            config.source_language,
            target,
            config.gummy_api_key,
        ),
        audio_pipeline=AudioPipeline(
            converter=lambda chunk: merge_chunk_channels(
                chunk,
                audio_source.CHANNELS,
            ),
            output_sample_rate=audio_source.RATE,
        ),
        external_translation=False,
    )


def _build_vosk(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    return _build_mono_16k_runtime(
        VoskProvider(config.vosk_model_path),
        config,
        audio_source,
        warning_handler,
        diagnostic_handler,
    )


def _build_sosv(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    if config.sosv_model_path is None:
        raise ValueError('SOSV model path is required')
    return _build_mono_16k_runtime(
        SosvProvider(config.sosv_model_path, config.source_language),
        config,
        audio_source,
        warning_handler,
        diagnostic_handler,
    )


def _build_glm(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    return _build_mono_16k_runtime(
        GlmProvider(config.glm_url, config.glm_model, config.glm_api_key),
        config,
        audio_source,
        warning_handler,
        diagnostic_handler,
    )


def _build_fun_asr(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    return _build_mono_16k_runtime(
        FunAsrProvider(
            FunAsrClientOptions(
                model=config.fun_asr_model,
                websocket_url=config.fun_asr_url,
                workspace_id=config.fun_asr_workspace,
                api_key=config.fun_asr_api_key,
                source_language=config.source_language,
                semantic_punctuation_enabled=(
                    config.fun_asr_semantic_punctuation
                ),
                max_sentence_silence_ms=(
                    config.fun_asr_max_sentence_silence
                ),
                heartbeat_enabled=config.fun_asr_heartbeat,
            ),
            hotwords=HotwordRuntimeConfig(
                vocabulary_id=config.fun_asr_vocabulary_id,
                target_model=config.fun_asr_vocabulary_model,
                context_terms=config.fun_asr_context_terms,
            ),
        ),
        config,
        audio_source,
        warning_handler,
        diagnostic_handler,
    )


def _build_apple_speech(
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    from utils.audioprcs import merge_chunk_channels

    return ProviderRuntime(
        provider=AppleSpeechProvider(
            helper_path=config.apple_speech_helper,
            locale=config.source_language,
            sample_rate=audio_source.RATE,
        ),
        audio_pipeline=AudioPipeline(
            converter=lambda chunk: merge_chunk_channels(
                chunk,
                audio_source.CHANNELS,
            ),
            output_sample_rate=audio_source.RATE,
        ),
    )


def _build_mono_16k_runtime(
    provider: RecognitionProvider,
    config: ProviderConfig,
    audio_source: AudioSource,
    warning_handler: Callable[[str], None],
    diagnostic_handler: Callable[[str, dict[str, object]], None],
) -> ProviderRuntime:
    from utils.audioprcs import resample_chunk_mono

    return ProviderRuntime(
        provider=provider,
        audio_pipeline=AudioPipeline(
            converter=lambda chunk: resample_chunk_mono(
                chunk,
                audio_source.CHANNELS,
                audio_source.RATE,
                16000,
            ),
            output_sample_rate=16000,
        ),
    )


def _target(target_language: str) -> str | None:
    return None if target_language == 'none' else target_language
