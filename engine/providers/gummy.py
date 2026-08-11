from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    UsageUpdated,
)


@dataclass(frozen=True)
class GummyClientBinding:
    client: Any
    retryable_errors: tuple[type[Exception], ...]


class GummyCallback:
    def __init__(self, provider: 'GummyProvider') -> None:
        self._provider = provider

    def on_open(self) -> None:
        self._provider.handle_open()

    def on_complete(self) -> None:
        return

    def on_error(self, message) -> None:
        self._provider.handle_error()

    def on_close(self) -> None:
        self._provider.handle_close()

    def on_event(
        self,
        request_id,
        transcription_result,
        translation_result,
        usage,
    ) -> None:
        self._provider.handle_event(
            transcription_result,
            translation_result,
            usage,
        )


GummyClientFactory = Callable[
    [int, str, str | None, str | None, GummyCallback],
    GummyClientBinding,
]


def _current_time() -> str:
    return datetime.now().strftime('%H:%M:%S.%f')[:-3]


def _build_client(
    sample_rate: int,
    source: str,
    target: str | None,
    api_key: str | None,
    callback: GummyCallback,
) -> GummyClientBinding:
    import dashscope
    from dashscope.audio.asr import (
        TranslationRecognizerCallback,
        TranslationRecognizerRealtime,
    )
    from dashscope.common.error import InvalidParameter

    if api_key:
        dashscope.api_key = api_key

    class CallbackAdapter(TranslationRecognizerCallback):
        def on_open(self) -> None:
            callback.on_open()

        def on_complete(self) -> None:
            callback.on_complete()

        def on_error(self, message) -> None:
            callback.on_error(message)

        def on_close(self) -> None:
            callback.on_close()

        def on_event(
            self,
            request_id,
            transcription_result,
            translation_result,
            usage,
        ) -> None:
            callback.on_event(
                request_id,
                transcription_result,
                translation_result,
                usage,
            )

    client = TranslationRecognizerRealtime(
        model='gummy-realtime-v1',
        format='pcm',
        sample_rate=sample_rate,
        transcription_enabled=True,
        translation_enabled=target is not None,
        source_language=source,
        translation_target_languages=[target],
        callback=CallbackAdapter(),
    )
    return GummyClientBinding(client, (InvalidParameter,))


class GummyProvider(RecognitionProvider):
    def __init__(
        self,
        sample_rate: int,
        source: str,
        target: str | None,
        api_key: str | None,
        client_factory: GummyClientFactory = _build_client,
        clock: Callable[[], str] = _current_time,
    ) -> None:
        super().__init__()
        self._sample_rate = sample_rate
        self._source = source
        self._target = target
        self._api_key = api_key
        self._client_factory = client_factory
        self._clock = clock
        self._client = None
        self._retryable_errors: tuple[type[Exception], ...] = ()
        self._callback = GummyCallback(self)
        self._caption_id = 0
        self._current_sentence_id = None
        self._started_at = ''
        self._usage = 0
        self._send_failures = 0
        self._started = False

    @property
    def name(self) -> str:
        return 'gummy'

    def start(self) -> None:
        binding = self._client_factory(
            self._sample_rate,
            self._source,
            self._target,
            self._api_key,
            self._callback,
        )
        self._client = binding.client
        self._retryable_errors = binding.retryable_errors
        self._started = True
        self._client.start()

    def accept_audio(self, frame: AudioFrame) -> None:
        if not self._started or self._client is None:
            raise RuntimeError('Gummy provider is not started')
        if frame.format != 'pcm_s16le':
            raise ValueError('Gummy requires pcm_s16le audio')
        if frame.sample_rate != self._sample_rate:
            raise ValueError(
                f'Gummy requires {self._sample_rate} Hz audio'
            )
        if frame.channels != 1 or frame.sample_width != 2:
            raise ValueError('Gummy requires mono PCM16 audio')
        try:
            self._client.send_audio_frame(frame.data)
        except self._retryable_errors:
            self._send_failures += 1
            if self._send_failures > 5:
                self._emit(ProviderError(
                    provider=self.name,
                    message='Gummy audio send failed after 5 retries.',
                    fatal=True,
                ))
            else:
                self._emit(ProviderInfo(
                    provider=self.name,
                    message=(
                        'Gummy engine stopped, restart attempt: '
                        f'{self._send_failures}...'
                    ),
                ))

    def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        if self._client is None:
            return
        try:
            self._client.stop()
        except Exception as error:
            self._emit(ProviderError(
                provider=self.name,
                message=f'Gummy stop failed ({type(error).__name__})',
                fatal=False,
            ))

    def handle_open(self) -> None:
        self._usage = 0
        self._current_sentence_id = None
        self._started_at = ''
        self._emit(ProviderReady(
            provider=self.name,
            message='Gummy translator started.',
        ))

    def handle_close(self) -> None:
        self._emit(ProviderStopped(
            provider=self.name,
            message='Gummy translator closed.',
        ))
        self._emit(UsageUpdated(
            provider=self.name,
            value=self._usage,
        ))

    def handle_error(self) -> None:
        self._emit(ProviderError(
            provider=self.name,
            message='Gummy callback reported an error.',
            fatal=True,
        ))

    def handle_event(
        self,
        transcription_result,
        translation_result,
        usage,
    ) -> None:
        if usage:
            duration = usage.get('duration', 0)
            if isinstance(duration, (int, float)):
                self._usage += duration
        if transcription_result is None:
            return

        sentence_id = transcription_result.sentence_id
        if self._current_sentence_id != sentence_id:
            self._started_at = self._clock()
            self._current_sentence_id = sentence_id
            self._caption_id += 1
        text = transcription_result.text
        if not isinstance(text, str):
            raise ValueError('Gummy transcription text must be a string')
        translation = self._read_translation(translation_result)
        event_type = (
            CaptionFinal
            if bool(transcription_result.is_sentence_end)
            else CaptionPartial
        )
        self._emit(event_type(
            caption_id=self._caption_id,
            started_at=self._started_at,
            ended_at=self._clock(),
            text=text,
            translation=translation,
        ))

    @staticmethod
    def _read_translation(translation_result) -> str:
        if translation_result is None:
            return ''
        languages = translation_result.get_language_list()
        if not languages:
            return ''
        translation = translation_result.get_translation(languages[0])
        text = translation.text
        if not isinstance(text, str):
            raise ValueError('Gummy translation text must be a string')
        return text
