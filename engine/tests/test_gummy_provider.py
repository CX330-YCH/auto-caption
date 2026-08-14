import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    UsageUpdated,
)
from providers.gummy import GummyClientBinding, GummyProvider  # noqa: E402


class RetryableSendError(Exception):
    pass


class FakeClient:
    def __init__(self, callback, fail_sends=False):
        self.callback = callback
        self.fail_sends = fail_sends
        self.sent = []

    def start(self):
        self.callback.on_open()

    def send_audio_frame(self, data):
        if self.fail_sends:
            raise RetryableSendError('secret-sdk-error')
        self.sent.append(data)

    def stop(self):
        self.callback.on_close()


class Transcription:
    def __init__(self, sentence_id, text, is_sentence_end):
        self.sentence_id = sentence_id
        self.text = text
        self.is_sentence_end = is_sentence_end


class Translation:
    def __init__(self, text):
        self.text = text


class TranslationResult:
    def __init__(self, text):
        self.text = text

    def get_language_list(self):
        return ['zh']

    def get_translation(self, language):
        return Translation(self.text)


class SdkErrorResult:
    def __init__(self):
        self.status_code = 403
        self.code = 'PermissionDenied'
        self.message = 'Rejected test-key'
        self.request_id = 'gummy-request-1'


def make_frame(sample_rate=16000):
    return AudioFrame(
        data=b'\x00\x00',
        sample_rate=sample_rate,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


class GummyProviderTests(unittest.TestCase):
    def test_maps_callback_partial_final_translation_and_usage(self):
        clients = []

        def factory(rate, source, target, api_key, callback):
            self.assertEqual((rate, source, target), (16000, 'zh', 'en'))
            client = FakeClient(callback)
            clients.append(client)
            return GummyClientBinding(client, (RetryableSendError,))

        timestamps = iter(['start', 'partial-end', 'final-end'])
        provider = GummyProvider(
            16000,
            'zh',
            'en',
            'test-key',
            client_factory=factory,
            clock=lambda: next(timestamps),
        )
        provider.start()
        ready = provider.drain_events()
        clients[0].callback.on_event(
            'request',
            Transcription(9, 'hello', False),
            TranslationResult('你好'),
            {'duration': 2},
        )
        partial = provider.drain_events()
        clients[0].callback.on_event(
            'request',
            Transcription(9, 'hello world', True),
            TranslationResult('你好世界'),
            {'duration': 3},
        )
        final = provider.drain_events()
        provider.stop()
        closed = provider.drain_events()

        self.assertIsInstance(ready[0], ProviderReady)
        self.assertEqual(partial, [
            CaptionPartial(1, 'start', 'partial-end', 'hello', '你好')
        ])
        self.assertEqual(final, [
            CaptionFinal(
                1,
                'start',
                'final-end',
                'hello world',
                '你好世界',
            )
        ])
        self.assertIsInstance(closed[0], ProviderStopped)
        self.assertEqual(closed[1], UsageUpdated('gummy', 5))

    def test_turns_repeated_send_failures_into_sanitized_fatal_error(self):
        def factory(rate, source, target, api_key, callback):
            return GummyClientBinding(
                FakeClient(callback, fail_sends=True),
                (RetryableSendError,),
            )

        provider = GummyProvider(
            16000,
            'zh',
            None,
            None,
            client_factory=factory,
        )
        provider.start()
        provider.drain_events()
        events = []
        for _ in range(6):
            provider.accept_audio(make_frame())
            events.extend(provider.drain_events())

        self.assertEqual(
            sum(isinstance(event, ProviderInfo) for event in events),
            5,
        )
        fatal = [
            event for event in events if isinstance(event, ProviderError)
        ][0]
        self.assertTrue(fatal.fatal)
        self.assertNotIn('secret-sdk-error', fatal.message)
        self.assertEqual(
            fatal.details['operation'],
            'gummy.send_audio_frame',
        )
        self.assertEqual(fatal.details['errorType'], 'RetryableSendError')
        self.assertIn('stackTrace', fatal.details)
        self.assertNotIn('secret-sdk-error', str(fatal.details))

    def test_preserves_sanitized_sdk_callback_error_details(self):
        clients = []

        def factory(rate, source, target, api_key, callback):
            client = FakeClient(callback)
            clients.append(client)
            return GummyClientBinding(client, (RetryableSendError,))

        provider = GummyProvider(
            16000,
            'zh',
            'en',
            'test-key',
            client_factory=factory,
        )
        provider.start()
        provider.drain_events()
        clients[0].callback.on_error(SdkErrorResult())

        error = provider.drain_events()[0]
        sdk_attributes = error.details['sdkResult']['attributes']
        self.assertEqual(error.details['operation'], 'gummy.callback.on_error')
        self.assertEqual(sdk_attributes['status_code'], 403)
        self.assertEqual(sdk_attributes['code'], 'PermissionDenied')
        self.assertEqual(sdk_attributes['request_id'], 'gummy-request-1')
        self.assertNotIn('test-key', str(error.details))

    def test_preserves_non_retryable_sdk_send_exception(self):
        class NonRetryableClient(FakeClient):
            def send_audio_frame(self, data):
                raise RuntimeError('SDK rejected test-key')

        provider = GummyProvider(
            16000,
            'zh',
            'en',
            'test-key',
            client_factory=lambda rate, source, target, key, callback: (
                GummyClientBinding(NonRetryableClient(callback), ())
            ),
        )
        provider.start()
        provider.drain_events()
        provider.accept_audio(make_frame())

        error = provider.drain_events()[0]
        self.assertTrue(error.fatal)
        self.assertEqual(error.details['errorType'], 'RuntimeError')
        self.assertEqual(error.details['operation'], 'gummy.send_audio_frame')
        self.assertNotIn('test-key', str(error.details))

    def test_rejects_wrong_sample_rate(self):
        provider = GummyProvider(
            16000,
            'zh',
            None,
            None,
            client_factory=lambda rate, source, target, key, callback: (
                GummyClientBinding(FakeClient(callback), ())
            ),
        )
        provider.start()
        provider.drain_events()

        with self.assertRaisesRegex(ValueError, '16000 Hz'):
            provider.accept_audio(make_frame(sample_rate=48000))


if __name__ == '__main__':
    unittest.main()
