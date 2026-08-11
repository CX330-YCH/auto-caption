import sys
import time
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import AudioFrame, CaptionFinal, ProviderError  # noqa: E402
from providers import GlmProvider  # noqa: E402


def make_frame():
    return AudioFrame(
        data=b'\x00\x00',
        sample_rate=16000,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


def wait_for_event(provider, event_type):
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        for event in provider.drain_events():
            if isinstance(event, event_type):
                return event
        time.sleep(0.01)
    raise AssertionError(f'{event_type.__name__} was not emitted')


class GlmProviderTests(unittest.TestCase):
    def test_segments_audio_and_emits_async_final(self):
        requests = []
        timestamps = iter(['start', 'end'])

        def request_factory(url, model, api_key):
            self.assertEqual(url, 'https://example.test/asr')
            self.assertEqual(model, 'glm-asr')
            self.assertEqual(api_key, 'test-key')

            def request(audio_content):
                requests.append(audio_content)
                return 'recognized text'

            return request

        provider = GlmProvider(
            'https://example.test/asr',
            'glm-asr',
            'test-key',
            request_factory=request_factory,
            rms_calculator=lambda data, width: 600 if data == b'sp' else 0,
            clock=lambda: next(timestamps),
        )
        provider.start()
        provider.drain_events()

        for _ in range(11):
            provider.accept_audio(AudioFrame(b'sp', 16000, 1, 2, 1.0))
        for _ in range(16):
            provider.accept_audio(make_frame())

        final = wait_for_event(provider, CaptionFinal)
        provider.stop()

        self.assertEqual(final.caption_id, 0)
        self.assertEqual(final.started_at, 'start')
        self.assertEqual(final.ended_at, 'end')
        self.assertEqual(final.text, 'recognized text')
        self.assertEqual(len(requests), 1)
        self.assertTrue(requests[0].startswith(b'RIFF'))

    def test_sanitizes_request_errors(self):
        provider = GlmProvider(
            'https://example.test/asr',
            'glm-asr',
            'test-key',
            request_factory=lambda url, model, key: (
                lambda audio: (_ for _ in ()).throw(
                    RuntimeError('secret-response-body')
                )
            ),
            rms_calculator=lambda data, width: 600 if data == b'sp' else 0,
        )
        provider.start()
        provider.drain_events()
        for _ in range(11):
            provider.accept_audio(AudioFrame(b'sp', 16000, 1, 2, 1.0))
        for _ in range(16):
            provider.accept_audio(make_frame())

        error = wait_for_event(provider, ProviderError)
        provider.stop()

        self.assertFalse(error.fatal)
        self.assertNotIn('secret-response-body', error.message)

    def test_rejects_non_http_endpoint(self):
        provider = GlmProvider('file:///tmp/asr', 'glm-asr', 'test-key')

        with self.assertRaisesRegex(ValueError, 'http or https'):
            provider.start()


if __name__ == '__main__':
    unittest.main()
