from collections.abc import Callable
from queue import Empty, Queue
from typing import Protocol

from .audio import AudioFrame, AudioSource
from .events import CaptionFinal, ProviderError, RecognitionEvent
from .provider import RecognitionProvider


class EventSink(Protocol):
    def publish(self, event: RecognitionEvent) -> None: ...


class TranslationService(Protocol):
    def submit(self, caption: CaptionFinal) -> None: ...
    def close(self) -> None: ...


class RecognitionSession:
    """Own the shared audio loop and provider-independent event policy."""

    def __init__(
        self,
        provider: RecognitionProvider,
        audio_queue: Queue[AudioFrame],
        audio_source: AudioSource,
        event_sink: EventSink,
        translation_service: TranslationService,
        start_audio_capture: Callable[[], None],
        is_running: Callable[[], bool],
        request_stop: Callable[[], None],
        queue_timeout: float = 0.1,
    ) -> None:
        if queue_timeout <= 0:
            raise ValueError('queue_timeout must be positive')
        self._provider = provider
        self._audio_queue = audio_queue
        self._audio_source = audio_source
        self._event_sink = event_sink
        self._translation_service = translation_service
        self._start_audio_capture = start_audio_capture
        self._is_running = is_running
        self._request_stop = request_stop
        self._queue_timeout = queue_timeout
        self._translated_caption_ids: set[int] = set()

    def run(self) -> None:
        try:
            self._provider.start()
            self._publish_pending_events()
            if self._is_running():
                self._start_audio_capture()
            while self._is_running():
                try:
                    frame = self._audio_queue.get(timeout=self._queue_timeout)
                except Empty:
                    self._publish_pending_events()
                    continue
                self._provider.accept_audio(frame)
                self._publish_pending_events()
        except Exception as error:
            self._event_sink.publish(ProviderError(
                provider=self._provider.name,
                message=(
                    f'{self._provider.name} provider failed '
                    f'({type(error).__name__})'
                ),
                fatal=True,
            ))
            self._request_stop()
        finally:
            try:
                self._provider.stop()
            except Exception as error:
                self._event_sink.publish(ProviderError(
                    provider=self._provider.name,
                    message=(
                        f'{self._provider.name} provider failed to stop '
                        f'({type(error).__name__})'
                    ),
                    fatal=False,
                ))
            try:
                self._publish_pending_events()
            finally:
                try:
                    self._translation_service.close()
                finally:
                    self._audio_source.close_stream()

    def _publish_pending_events(self) -> None:
        for event in self._provider.drain_events():
            self._event_sink.publish(event)
            if isinstance(event, ProviderError) and event.fatal:
                self._request_stop()
            if not isinstance(event, CaptionFinal):
                continue
            if event.caption_id in self._translated_caption_ids:
                continue
            self._translated_caption_ids.add(event.caption_id)
            self._translation_service.submit(event)
