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
from providers import VoskProvider  # noqa: E402


class FakeRecognizer:
    def __init__(self):
        self._responses = [
            (False, '{"partial":"hello"}'),
            (False, '{"partial":"hello"}'),
            (True, '{"text":"hello world"}'),
        ]
        self._current = None

    def AcceptWaveform(self, data):
        self._current = self._responses.pop(0)
        return self._current[0]

    def PartialResult(self):
        return self._current[1]

    def Result(self):
        return self._current[1]


def make_frame(sample_rate=16000):
    return AudioFrame(
        data=b'\x00\x00',
        sample_rate=sample_rate,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


class VoskProviderTests(unittest.TestCase):
    def test_emits_partial_and_final_events_without_translation(self):
        recognizer = FakeRecognizer()
        factory_calls = []
        timestamps = iter(['start', 'partial-end', 'final-end'])
        provider = VoskProvider(
            '"model-path"',
            recognizer_factory=lambda path, rate: (
                factory_calls.append((path, rate)) or recognizer
            ),
            clock=lambda: next(timestamps),
        )

        provider.start()
        ready_events = provider.drain_events()
        provider.accept_audio(make_frame())
        partial_events = provider.drain_events()
        provider.accept_audio(make_frame())
        duplicate_events = provider.drain_events()
        provider.accept_audio(make_frame())
        final_events = provider.drain_events()
        provider.stop()
        stopped_events = provider.drain_events()

        self.assertEqual(factory_calls, [('model-path', 16000)])
        self.assertIsInstance(ready_events[0], ProviderReady)
        self.assertEqual(partial_events, [
            CaptionPartial(0, 'start', 'partial-end', 'hello')
        ])
        self.assertEqual(duplicate_events, [])
        self.assertEqual(final_events, [
            CaptionFinal(0, 'start', 'final-end', 'hello world')
        ])
        self.assertIsInstance(stopped_events[0], ProviderStopped)

    def test_rejects_audio_outside_vosk_contract(self):
        provider = VoskProvider(
            'model-path',
            recognizer_factory=lambda path, rate: FakeRecognizer(),
        )
        provider.start()
        provider.drain_events()

        with self.assertRaisesRegex(ValueError, '16000 Hz'):
            provider.accept_audio(make_frame(sample_rate=48000))


if __name__ == '__main__':
    unittest.main()
