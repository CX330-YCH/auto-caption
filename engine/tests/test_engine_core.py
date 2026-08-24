import sys
import unittest
from pathlib import Path
from queue import Queue


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioCaptureWorker,
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
        self.opened = False
        self.closed = False
        self.close_signaled = False

    def open_stream(self):
        self.opened = True
        return None

    def read_chunk(self):
        return None

    def close_stream_signal(self):
        self.close_signaled = True

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


class StartFatalProvider(RecognitionProvider):
    def __init__(self):
        super().__init__()
        self.stopped = False

    @property
    def name(self):
        return 'start_fatal'

    def start(self):
        self._emit(ProviderError(
            provider=self.name,
            message='permanent startup failure',
            fatal=True,
        ))

    def accept_audio(self, frame):
        raise AssertionError('audio must not be accepted after startup fatal')

    def stop(self):
        self.stopped = True


class RuntimeFatalProvider(RecognitionProvider):
    def __init__(self):
        super().__init__()
        self.accepted = 0
        self.stopped = False

    @property
    def name(self):
        return 'runtime_fatal'

    def start(self):
        self._emit(ProviderReady(self.name, 'ready'))

    def accept_audio(self, frame):
        self.accepted += 1
        self._emit(ProviderError(
            provider=self.name,
            message='permanent runtime failure',
            fatal=True,
        ))

    def stop(self):
        self.stopped = True


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

    def test_capture_worker_uses_pipeline_and_bounded_output_queue(self):
        source = FakeAudioSource()
        source.read_chunk = lambda: b'\x01\x02'
        output_queue = Queue(maxsize=1)
        running_checks = iter([True, True, False])
        stop_requests = []
        errors = []
        metrics = []
        worker = AudioCaptureWorker(
            source=source,
            pipeline=AudioPipeline(
                converter=lambda chunk: chunk[::-1],
                output_sample_rate=16000,
                clock=lambda: 1.5,
            ),
            output_queue=output_queue,
            is_running=lambda: next(running_checks),
            request_stop=lambda: stop_requests.append(True),
            info_handler=lambda message: None,
            error_handler=errors.append,
            metric_handler=lambda category, name, fields: metrics.append(
                (category, name, fields)
            ),
        )

        worker.run()

        frame = output_queue.get_nowait()
        self.assertTrue(source.opened)
        self.assertTrue(source.close_signaled)
        self.assertEqual(frame.data, b'\x02\x01')
        self.assertEqual(stop_requests, [])
        self.assertEqual(errors, [])
        self.assertEqual(metrics[0][0:2], (
            'audio.capture',
            'frame.enqueued',
        ))
        self.assertEqual(metrics[0][2]['queueDepth'], 1)
        self.assertEqual(metrics[0][2]['queueCapacity'], 1)

    def test_capture_worker_reports_full_exception_diagnostic(self):
        source = FakeAudioSource()
        source.open_stream = lambda: (_ for _ in ()).throw(
            OSError('audio device failed')
        )
        errors = []
        diagnostics = []
        stop_requests = []
        worker = AudioCaptureWorker(
            source=source,
            pipeline=AudioPipeline(
                converter=lambda chunk: chunk,
                output_sample_rate=16000,
            ),
            output_queue=Queue(maxsize=1),
            is_running=lambda: True,
            request_stop=lambda: stop_requests.append(True),
            info_handler=lambda message: None,
            error_handler=errors.append,
            diagnostic_handler=lambda message, details: (
                diagnostics.append((message, details))
            ),
        )

        worker.run()

        self.assertEqual(errors, ['Audio capture failed (OSError)'])
        self.assertEqual(stop_requests, [True])
        self.assertEqual(diagnostics[0][1]['operation'], 'audio.capture')
        self.assertEqual(diagnostics[0][1]['errorType'], 'OSError')
        self.assertIn('stackTrace', diagnostics[0][1])
        self.assertTrue(source.close_signaled)


class RecognitionSessionTests(unittest.TestCase):
    def test_startup_fatal_skips_capture_and_closes_owned_resources(self):
        provider = StartFatalProvider()
        audio_source = FakeAudioSource()
        event_sink = FakeEventSink()
        translation = FakeTranslationService()
        capture_starts = []
        running = [True]

        def request_stop():
            running[0] = False

        session = RecognitionSession(
            provider=provider,
            audio_queue=Queue(),
            audio_source=audio_source,
            event_sink=event_sink,
            translation_service=translation,
            start_audio_capture=lambda: capture_starts.append(True),
            is_running=lambda: running[0],
            request_stop=request_stop,
            queue_timeout=0.01,
        )

        session.run()

        self.assertEqual(capture_starts, [])
        self.assertTrue(provider.stopped)
        self.assertTrue(audio_source.closed)
        self.assertTrue(translation.closed)
        self.assertEqual(
            sum(
                isinstance(event, ProviderError) and event.fatal
                for event in event_sink.events
            ),
            1,
        )

    def test_runtime_fatal_uses_normal_session_cleanup(self):
        provider = RuntimeFatalProvider()
        audio_queue = Queue()
        audio_queue.put(make_frame())
        audio_source = FakeAudioSource()
        event_sink = FakeEventSink()
        translation = FakeTranslationService()
        capture_starts = []
        running = [True]

        def request_stop():
            running[0] = False

        session = RecognitionSession(
            provider=provider,
            audio_queue=audio_queue,
            audio_source=audio_source,
            event_sink=event_sink,
            translation_service=translation,
            start_audio_capture=lambda: capture_starts.append(True),
            is_running=lambda: running[0],
            request_stop=request_stop,
            queue_timeout=0.01,
        )

        session.run()

        self.assertEqual(capture_starts, [True])
        self.assertEqual(provider.accepted, 1)
        self.assertTrue(provider.stopped)
        self.assertTrue(audio_source.closed)
        self.assertTrue(translation.closed)
        self.assertEqual(
            sum(
                isinstance(event, ProviderError) and event.fatal
                for event in event_sink.events
            ),
            1,
        )

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
        metrics = []
        session = RecognitionSession(
            provider=provider,
            audio_queue=audio_queue,
            audio_source=audio_source,
            event_sink=event_sink,
            translation_service=translation,
            start_audio_capture=lambda: capture_starts.append(True),
            is_running=lambda: not audio_queue.empty(),
            request_stop=lambda: stop_requests.append(True),
            metric_handler=lambda category, name, fields: metrics.append(
                (category, name, fields)
            ),
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
        self.assertTrue(any(
            category == 'recognition.session' and
            name == 'frame.accepted' and
            'frameAgeMs' in fields
            for category, name, fields in metrics
        ))
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
        self.assertEqual(
            errors[0].details['operation'],
            'provider.session.run',
        )
        self.assertEqual(errors[0].details['errorType'], 'RuntimeError')
        self.assertIn('stackTrace', errors[0].details)
        self.assertNotIn('secret-token', str(errors[0].details))
        self.assertTrue(audio_source.closed)
        self.assertTrue(translation.closed)


if __name__ == '__main__':
    unittest.main()
