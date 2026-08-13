import sys
import unittest
from datetime import datetime
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderDebug,
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    UsageUpdated,
)
from providers.fun_asr import (  # noqa: E402
    _DashScopeRecognitionClient,
    _is_retryable_failure,
    FunAsrClientOptions,
    FunAsrProvider,
)


class FakeClient:
    def __init__(self, callback, fail_send=False):
        self.callback = callback
        self.fail_send = fail_send
        self.sent = []
        self.stopped = False
        self.aborted = False

    def start(self, phrase_id=None, **kwargs):
        self.phrase_id = phrase_id
        self.start_kwargs = kwargs
        self.callback.on_open()

    def send_audio_frame(self, data):
        if self.fail_send:
            raise RuntimeError('secret-sdk-payload')
        self.sent.append(data)

    def stop(self):
        self.stopped = True
        self.callback.on_complete()
        self.callback.on_close()

    def can_stop(self):
        return not self.aborted

    def abort_failed(self):
        self.aborted = True


class FakeResult:
    def __init__(
        self,
        sentence,
        usage=None,
        status_code=None,
        code=None,
        message=None,
        request_id=None,
    ):
        self._sentence = sentence
        self._usage = usage
        self.status_code = status_code
        self.code = code
        self.message = message
        self.request_id = request_id

    def get_sentence(self):
        return self._sentence

    def get_usage(self, sentence):
        return self._usage

    @staticmethod
    def is_sentence_end(sentence):
        return sentence.get('end_time') is not None


def options(**overrides):
    values = {
        'model': 'fun-asr-realtime',
        'websocket_url': (
            'wss://workspace-1.cn-beijing.maas.aliyuncs.com/'
            'api-ws/v1/inference'
        ),
        'workspace_id': 'workspace-1',
        'api_key': 'dummy-credential',
        'source_language': 'zh',
    }
    values.update(overrides)
    return FunAsrClientOptions(**values)


def frame(data=b'\x00\x00', captured_at=10.0, sample_rate=16000):
    return AudioFrame(
        data=data,
        sample_rate=sample_rate,
        channels=1,
        sample_width=2,
        captured_at=captured_at,
    )


class FunAsrProviderTests(unittest.TestCase):
    def test_classifies_permanent_and_transient_service_failures(self):
        cases = (
            (401, 'InvalidApiKey', False),
            (403, 'PermissionDenied', False),
            (503, 'ModelUnavailable', False),
            (503, 'ServiceUnavailable', True),
            (429, 'Throttling', True),
            (None, 'ConnectionTimeout', True),
        )
        for status_code, code, expected in cases:
            with self.subTest(status_code=status_code, code=code):
                self.assertEqual(
                    _is_retryable_failure(status_code, code),
                    expected,
                )

    def test_sdk_adapter_cancels_failed_task_timer_without_stopping(self):
        class FakeTimer:
            def __init__(self):
                self.canceled = False

            def cancel(self):
                self.canceled = True

        class FakeRecognition:
            def __init__(self):
                self._running = False
                self._silence_timer = FakeTimer()
                self.stop_calls = 0

            def stop(self):
                self.stop_calls += 1

        recognition = FakeRecognition()
        timer = recognition._silence_timer
        client = _DashScopeRecognitionClient(recognition)

        self.assertFalse(client.can_stop())
        client.abort_failed()

        self.assertTrue(timer.canceled)
        self.assertIsNone(recognition._silence_timer)
        self.assertEqual(recognition.stop_calls, 0)

    def test_maps_partial_final_heartbeat_usage_and_server_timestamps(self):
        clients = []

        def factory(client_options, callback):
            self.assertEqual(client_options.source_language, 'zh')
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
            clock=lambda: datetime(2026, 8, 12, 12, 0, 0),
        )
        provider.start()
        self.assertIsInstance(provider.drain_events()[0], ProviderReady)
        provider.accept_audio(frame())
        clients[0].callback.on_event(FakeResult({
            'sentence_id': 0,
            'heartbeat': True,
            'text': '',
        }))
        self.assertEqual(provider.drain_events(), [])

        clients[0].callback.on_event(FakeResult({
            'sentence_id': 1,
            'heartbeat': False,
            'sentence_end': False,
            'begin_time': 170,
            'end_time': None,
            'text': '你好',
        }))
        self.assertEqual(provider.drain_events(), [
            CaptionPartial(
                1_000_001,
                '12:00:00.170',
                '12:00:00.170',
                '你好',
            )
        ])

        clients[0].callback.on_event(FakeResult({
            'sentence_id': 1,
            'heartbeat': False,
            'sentence_end': True,
            'begin_time': 170,
            'end_time': 920,
            'text': '你好。',
        }, {'duration': 2}))
        self.assertEqual(provider.drain_events(), [
            CaptionFinal(
                1_000_001,
                '12:00:00.170',
                '12:00:00.920',
                '你好。',
            ),
            UsageUpdated('fun_asr', 2, 'seconds'),
        ])

        clients[0].callback.on_event(FakeResult({
            'sentence_id': 1,
            'sentence_end': True,
            'begin_time': 170,
            'end_time': 920,
            'text': '重复结果',
        }))
        self.assertEqual(provider.drain_events(), [])

    def test_passes_vocabulary_and_context_for_each_task(self):
        from services.hotwords import HotwordRuntimeConfig

        clients = []

        def factory(client_options, callback):
            self.assertEqual(
                client_options.vocabulary_id,
                'vocab-project-1',
            )
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
            clock=lambda: datetime(2026, 8, 12, 12, 0, 0),
            hotwords=HotwordRuntimeConfig(
                vocabulary_id='vocab-project-1',
                target_model='fun-asr-realtime',
                context_terms=('Auto Caption', '阿里云百炼'),
            ),
        )
        provider.start()
        provider.drain_events()

        self.assertIsNone(clients[0].phrase_id)
        self.assertEqual(
            clients[0].start_kwargs['raw_input']['context'][0]['content'][0],
            {
                'type': 'input_text',
                'text': 'Auto Caption\n阿里云百炼',
            },
        )

        clients[0].callback.on_error(FakeResult({}))
        provider.drain_events()
        self.assertIsNone(clients[1].phrase_id)
        self.assertEqual(
            clients[1].start_kwargs['raw_input'],
            clients[0].start_kwargs['raw_input'],
        )

    def test_reconnects_with_backoff_and_flushes_bounded_audio(self):
        clients = []
        delays = []

        def factory(client_options, callback):
            client = FakeClient(callback, fail_send=not clients)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=delays.append,
        )
        provider.start()
        provider.drain_events()
        provider.accept_audio(frame(data=b'audio'))
        events = provider.drain_events()

        self.assertEqual(delays, [0.25])
        self.assertEqual(clients[1].sent, [b'audio'])
        self.assertTrue(any(isinstance(event, ProviderInfo) for event in events))
        self.assertTrue(any(isinstance(event, ProviderReady) for event in events))

    def test_reconnect_starts_a_new_server_timestamp_epoch(self):
        clients = []
        times = iter([
            datetime(2026, 8, 12, 12, 0, 0),
            datetime(2026, 8, 12, 12, 1, 0),
            datetime(2026, 8, 12, 12, 2, 0),
        ])

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
            clock=lambda: next(times),
        )
        provider.start()
        provider.drain_events()
        clients[0].callback.on_error(FakeResult({}))
        provider.drain_events()
        clients[1].callback.on_event(FakeResult({
            'sentence_id': 1,
            'sentence_end': False,
            'begin_time': 250,
            'end_time': None,
            'text': '新任务',
        }))

        event = provider.drain_events()[0]
        self.assertEqual(event.started_at, '12:02:00.250')
        self.assertEqual(event.ended_at, '12:02:00.250')

    def test_exhausts_reconnects_without_exposing_sdk_error(self):
        clients = []

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
            max_reconnects=2,
        )
        provider.start()
        provider.drain_events()
        clients[-1].callback.on_error(FakeResult({}))
        clients[-1].callback.on_error(FakeResult({}))
        clients[-1].callback.on_error(FakeResult({}))
        events = provider.drain_events()
        fatal = [event for event in events if isinstance(event, ProviderError)]

        self.assertEqual(len(fatal), 1)
        self.assertTrue(fatal[0].fatal)
        self.assertNotIn('secret', fatal[0].message)

    def test_error_close_stop_sequence_is_idempotent_and_skips_failed_stop(self):
        clients = []

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
        )
        provider.start()
        provider.drain_events()
        failed_client = clients[0]
        failure = FakeResult(
            {},
            status_code=401,
            code='InvalidApiKey',
            message=(
                'Invalid API key dummy-credential '
                'sk-example-secret-value'
            ),
            request_id='request-1',
        )

        failed_client.callback.on_error(failure)
        failed_client.callback.on_close()
        provider.stop()
        events = provider.drain_events()

        self.assertEqual(len(clients), 1)
        self.assertTrue(failed_client.aborted)
        self.assertFalse(failed_client.stopped)
        fatal = [
            event for event in events
            if isinstance(event, ProviderError) and event.fatal
        ]
        self.assertEqual(len(fatal), 1)
        self.assertEqual(fatal[0].details['statusCode'], 401)
        self.assertEqual(fatal[0].details['requestId'], 'request-1')
        self.assertNotIn('dummy-credential', str(events))
        self.assertNotIn('sk-example', str(events))
        self.assertFalse(any(
            isinstance(event, ProviderError) and 'stop failed' in event.message
            for event in events
        ))
        self.assertTrue(any(isinstance(event, ProviderDebug) for event in events))
        self.assertEqual(
            sum(isinstance(event, ProviderStopped) for event in events),
            1,
        )

    def test_error_then_close_starts_only_one_transient_reconnect(self):
        clients = []

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
            max_reconnects=2,
        )
        provider.start()
        provider.drain_events()
        failed_client = clients[0]
        failure = FakeResult(
            {},
            status_code=503,
            code='ServiceUnavailable',
            message='Try again later.',
            request_id='request-2',
        )

        failed_client.callback.on_error(failure)
        failed_client.callback.on_error(failure)
        failed_client.callback.on_close()
        events = provider.drain_events()

        self.assertEqual(len(clients), 2)
        self.assertEqual(
            sum(
                isinstance(event, ProviderInfo) and
                'reconnect attempt' in event.message
                for event in events
            ),
            1,
        )
        self.assertFalse(any(
            isinstance(event, ProviderError) and event.fatal
            for event in events
        ))

    def test_model_unavailable_is_permanent_even_with_503_status(self):
        clients = []

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(
            options(),
            client_factory=factory,
            sleeper=lambda delay: None,
        )
        provider.start()
        provider.drain_events()

        clients[0].callback.on_error(FakeResult(
            {},
            status_code=503,
            code='ModelUnavailable',
            message='The selected model is unavailable.',
        ))
        events = provider.drain_events()

        self.assertEqual(len(clients), 1)
        self.assertEqual(
            sum(
                isinstance(event, ProviderError) and event.fatal
                for event in events
            ),
            1,
        )

    def test_stop_flushes_task_and_emits_stopped_once(self):
        clients = []

        def factory(client_options, callback):
            client = FakeClient(callback)
            clients.append(client)
            return client

        provider = FunAsrProvider(options(), client_factory=factory)
        provider.start()
        provider.drain_events()
        provider.stop()
        provider.stop()

        events = provider.drain_events()
        self.assertTrue(clients[0].stopped)
        self.assertEqual(
            sum(isinstance(event, ProviderStopped) for event in events),
            1,
        )

    def test_rejects_invalid_endpoint_and_audio_contract(self):
        with self.assertRaisesRegex(ValueError, 'endpoint/workspace'):
            FunAsrProvider(options(
                websocket_url=(
                    'wss://other.cn-beijing.maas.aliyuncs.com/'
                    'api-ws/v1/inference'
                )
            ))

        provider = FunAsrProvider(
            options(),
            client_factory=lambda client_options, callback: (
                FakeClient(callback)
            ),
        )
        provider.start()
        provider.drain_events()
        with self.assertRaisesRegex(ValueError, '16000 Hz'):
            provider.accept_audio(frame(sample_rate=48000))


if __name__ == '__main__':
    unittest.main()
