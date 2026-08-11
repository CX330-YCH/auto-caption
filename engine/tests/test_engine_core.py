import sys
import unittest
from pathlib import Path
from queue import Queue


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    AudioPipeline,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    RecognitionSession,
)


def make_frame(data=b'\x00\x00'):
    return AudioFrame(
        data=data,
        sample_rate=16000,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


class FakeAudioSource:
    RATE = 16000
    CHANNELS = 1
    SAMP_WIDTH = 2

    def __init__(self):
        self.closed = False

    def open_stream(self):
        return None

    def read_chunk(self):
        return None

    def close_stream_signal(self):
        return None

    def close_stream(self):
        self.closed = True


class FakeProvider(RecognitionProvider):
    def __init__(self):
        super().__init__()
        self.accepted = 0
        self.stopped = False

    @property
    def name(self):
        return 'fake'

    def start(self):
        self._emit(ProviderReady('fake', 'ready'))

    def accept_audio(self, frame):
        self.accepted += 1
        if self.accepted == 1:
            self._emit(CaptionPartial(7, 'start', 'partial', 'hel'))
        else:
            final = CaptionFinal(7, 'start', 'final', 'hello')
            self._emit(final)
            self._emit(final)

    def stop(self):
        self.stopped = True
        self._emit(ProviderStopped('fake', 'stopped'))


class FailingProvider(RecognitionProvider):
    @property
    def name(self):
        return 'failing'

    def start(self):
        return None

    def accept_audio(self, frame):
        raise RuntimeError('secret-token-must-not-leak')

    def stop(self):
        return None


class FakeEventSink:
    def __init__(self):
        self.events = []

    def publish(self, event):
        self.events.append(event)


class FakeTranslationService:
    def __init__(self):
        self.captions = []
        self.closed = False

    def submit(self, caption):
        self.captions.append(caption)

    def close(self):
        self.closed = True


class AudioCoreTests(unittest.TestCase):
    def test_pipeline_builds_self_describing_audio_frame(self):
        pipeline = AudioPipeline(
            converter=lambda chunk: chunk[::-1],
            output_sample_rate=16000,
            clock=lambda: 12.5,
        )

        frame = pipeline.process(b'\x01\x02')

        self.assertEqual(frame.data, b'\x02\x01')
        self.assertEqual(frame.sample_rate, 16000)
        self.assertEqual(frame.channels, 1)
        self.assertEqual(frame.sample_width, 2)
        self.assertEqual(frame.captured_at, 12.5)
        self.assertEqual(frame.format, 'pcm_s16le')

    def test_audio_frame_rejects_invalid_metadata(self):
        with self.assertRaises(ValueError):
            AudioFrame(b'', 0, 1, 2, 0.0)


class RecognitionSessionTests(unittest.TestCase):
    def test_session_translates_final_once_and_closes_owned_resources(self):
        provider = FakeProvider()
        audio_queue = Queue()
        audio_queue.put(make_frame())
        audio_queue.put(make_frame())
        audio_source = FakeAudioSource()
        event_sink = FakeEventSink()
        translation = FakeTranslationService()
        capture_starts = []
        stop_requests = []
        session = RecognitionSession(
            provider=provider,
            audio_queue=audio_queue,
            audio_source=audio_source,
            event_sink=event_sink,
            translation_service=translation,
            start_audio_capture=lambda: capture_starts.append(True),
            is_running=lambda: not audio_queue.empty(),
            request_stop=lambda: stop_requests.append(True),
            queue_timeout=0.01,
        )

        session.run()

        self.assertEqual(capture_starts, [True])
        self.assertEqual(provider.accepted, 2)
        self.assertTrue(provider.stopped)
        self.assertTrue(audio_source.closed)
        self.assertTrue(translation.closed)
        self.assertEqual(len(translation.captions), 1)
        self.assertEqual(translation.captions[0].text, 'hello')
        self.assertEqual(stop_requests, [])
        self.assertEqual(
            sum(isinstance(event, CaptionPartial) for event in event_sink.events),
            1,
        )

    def test_session_reports_sanitized_provider_failure_and_requests_stop(self):
        audio_queue = Queue()
        audio_queue.put(make_frame())
        audio_source = FakeAudioSource()
        event_sink = FakeEventSink()
        translation = FakeTranslationService()
        stop_requests = []
        session = RecognitionSession(
            provider=FailingProvider(),
            audio_queue=audio_queue,
            audio_source=audio_source,
            event_sink=event_sink,
            translation_service=translation,
            start_audio_capture=lambda: None,
            is_running=lambda: True,
            request_stop=lambda: stop_requests.append(True),
            queue_timeout=0.01,
        )

        session.run()

        errors = [
            event for event in event_sink.events
            if isinstance(event, ProviderError)
        ]
        self.assertEqual(stop_requests, [True])
        self.assertEqual(len(errors), 1)
        self.assertNotIn('secret-token', errors[0].message)
        self.assertTrue(audio_source.closed)
        self.assertTrue(translation.closed)


if __name__ == '__main__':
    unittest.main()
