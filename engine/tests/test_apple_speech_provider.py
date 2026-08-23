import io
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    CaptionRevoked,
    ProviderReady,
)
from providers.apple_speech import AppleSpeechProvider  # noqa: E402


class FakeProcess:
    def __init__(self, lines):
        self.stdin = io.BytesIO()
        self.stdout = lines
        self.stderr = io.BytesIO()
        self.returncode = None

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        self.returncode = 0
        return 0

    def terminate(self):
        self.returncode = -15

    def kill(self):
        self.returncode = -9


class AppleSpeechProviderTests(unittest.TestCase):
    def test_lifecycle_audio_and_transcript_reconciliation_events(self):
        lines = [
            b'{"protocolVersion":1,"type":"ready","payload":{}}\n',
            b'{"protocolVersion":1,"type":"transcript","payload":{"phase":"partial","id":3,"text":"hel","startSeconds":0.25,"endSeconds":0.5}}\n',
            b'{"protocolVersion":1,"type":"transcript","payload":{"phase":"final","id":3,"text":"hello","startSeconds":0.25,"endSeconds":0.75}}\n',
            b'{"protocolVersion":1,"type":"transcript","payload":{"phase":"revoke","id":4}}\n',
        ]
        process = FakeProcess(lines)
        with tempfile.NamedTemporaryFile() as helper:
            provider = AppleSpeechProvider(
                helper.name,
                'en-US',
                48000,
                process_factory=lambda *args, **kwargs: process,
                wall_clock=lambda: datetime(2026, 1, 2, 12, 0, 0),
            )
            provider.start()
            provider.accept_audio(AudioFrame(
                data=b'\x00\x00', sample_rate=48000, channels=1,
                sample_width=2, captured_at=0,
            ))
            events = provider.drain_events()

        self.assertIsInstance(events[0], ProviderReady)
        self.assertIsInstance(events[1], CaptionPartial)
        self.assertEqual(events[1].started_at, '12:00:00.250')
        self.assertIsInstance(events[2], CaptionFinal)
        self.assertEqual(events[2].ended_at, '12:00:00.750')
        self.assertEqual(events[2].caption_id, 3)
        self.assertIsInstance(events[3], CaptionRevoked)

    def test_rejects_non_mono_audio(self):
        provider = AppleSpeechProvider('/unused', 'en-US', 48000)
        with self.assertRaisesRegex(ValueError, 'mono'):
            provider.accept_audio(AudioFrame(
                data=b'\x00\x00\x00\x00', sample_rate=48000,
                channels=2, sample_width=2, captured_at=0,
            ))


if __name__ == '__main__':
    unittest.main()
