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
    ProviderInfo,
    ProviderReady,
    ProviderStopped,
    UsageUpdated,
)
from providers.fun_asr import (  # noqa: E402
    FunAsrClientOptions,
    FunAsrProvider,
)


class FakeClient:
    def __init__(self, callback, fail_send=False):
        self.callback = callback
        self.fail_send = fail_send
        self.sent = []
        self.stopped = False

    def start(self):
        self.callback.on_open()

    def send_audio_frame(self, data):
        if self.fail_send:
            raise RuntimeError('secret-sdk-payload')
        self.sent.append(data)

    def stop(self):
        self.stopped = True
        self.callback.on_complete()
        self.callback.on_close()


class FakeResult:
    def __init__(self, sentence, usage=None):
        self._sentence = sentence
        self._usage = usage

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
