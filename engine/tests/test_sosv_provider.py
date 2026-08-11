import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderReady,
    ProviderStopped,
)
from providers.sosv import SosvProvider, SosvRecognition  # noqa: E402


class FakeBackend:
    def __init__(self):
        self.started = False
        self.stopped = False
        self.results = [
            [SosvRecognition('hello', final=False)],
            [SosvRecognition('hello', final=False)],
            [SosvRecognition('Hello.', final=True)],
        ]

    def start(self):
        self.started = True

    def accept_audio(self, data):
        return self.results.pop(0)

    def stop(self):
        self.stopped = True


def make_frame(sample_rate=16000):
    return AudioFrame(
        data=b'\x00\x00',
        sample_rate=sample_rate,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


class SosvProviderTests(unittest.TestCase):
    def test_maps_backend_partial_and_final_with_stable_caption_id(self):
        backend = FakeBackend()
        timestamps = iter(['start', 'partial-end', 'final-end', 'next-start'])
        factory_calls = []
        provider = SosvProvider(
            '"model-path"',
            'en',
            backend_factory=lambda path, source: (
                factory_calls.append((path, source)) or backend
            ),
            clock=lambda: next(timestamps),
        )

        provider.start()
        ready = provider.drain_events()
        provider.accept_audio(make_frame())
        partial = provider.drain_events()
        provider.accept_audio(make_frame())
        duplicate = provider.drain_events()
        provider.accept_audio(make_frame())
        final = provider.drain_events()
        provider.stop()
        stopped = provider.drain_events()

        self.assertEqual(factory_calls, [('model-path', 'en')])
        self.assertTrue(backend.started)
        self.assertIsInstance(ready[0], ProviderReady)
        self.assertEqual(partial, [
            CaptionPartial(0, 'start', 'partial-end', 'hello')
        ])
        self.assertEqual(duplicate, [])
        self.assertEqual(final, [
            CaptionFinal(0, 'start', 'final-end', 'Hello.')
        ])
        self.assertTrue(backend.stopped)
        self.assertIsInstance(stopped[0], ProviderStopped)

    def test_rejects_audio_outside_sosv_contract(self):
        provider = SosvProvider(
            'model-path',
            'auto',
            backend_factory=lambda path, source: FakeBackend(),
        )
        provider.start()
        provider.drain_events()

        with self.assertRaisesRegex(ValueError, '16000 Hz'):
            provider.accept_audio(make_frame(sample_rate=48000))


if __name__ == '__main__':
    unittest.main()
