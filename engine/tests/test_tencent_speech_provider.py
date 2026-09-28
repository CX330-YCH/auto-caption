import sys
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderReady,
    ProviderStopped,
)
from providers.tencent_speech_translate import (  # noqa: E402
    TencentHotword,
    TencentSpeechOptions,
    TencentSpeechTranslateProvider,
    _WebSocketClient,
    build_signed_url,
    encode_hotword_list,
)


class FakeClient:
    def __init__(self, response_handler, fail_start=False):
        self.response_handler = response_handler
        self.fail_start = fail_start
        self.sent = []
        self.stopped = False

    def start(self):
        if self.fail_start:
            raise RuntimeError('rejected secret-key')
        self.response_handler({'code': 0, 'message': 'success'})

    def send_audio(self, data):
        self.sent.append(data)

    def stop(self):
        self.stopped = True


def options(**changes):
    values = {
        'app_id': '123456',
        'secret_id': 'secret-id',
        'secret_key': 'secret-key',
        'source_language': 'zh',
        'target_language': 'en',
    }
    values.update(changes)
    return TencentSpeechOptions(**values)


def frame(data=b'\x00' * 3200):
    return AudioFrame(
        data=data,
        sample_rate=16000,
        channels=1,
        sample_width=2,
        captured_at=1.0,
    )


class TencentSpeechProviderTests(unittest.TestCase):
    def test_maps_partial_final_translation_and_server_timestamps(self):
        clients = []

        def factory(config, response, failure, close):
            client = FakeClient(response)
            clients.append(client)
            return client

        provider = TencentSpeechTranslateProvider(
            options(),
            client_factory=factory,
            clock=lambda: datetime(2026, 9, 11, 9, 30, 0),
        )
        provider.start()
        self.assertEqual(
            provider.drain_events(),
            [ProviderReady(
                'tencent_speech_translate',
                'Tencent speech translation started.',
            )],
        )

        clients[0].response_handler({
            'code': 0,
            'sentence_id': 'sentence-1',
            'result': {
                'source_text': '实时',
                'target_text': 'Real time',
                'start_time': 1000,
                'end_time': 1240,
                'sentence_end': False,
            },
        })
        clients[0].response_handler({
            'code': 0,
            'sentence_id': 'sentence-1',
            'result': {
                'source_text': '实时语音翻译',
                'target_text': 'Real-time speech translation',
                'start_time': 1000,
                'end_time': 2840,
                'sentence_end': True,
            },
        })

        self.assertEqual(provider.drain_events(), [
            CaptionPartial(
                1, '09:30:01.000', '09:30:01.240', '实时', 'Real time'
            ),
            CaptionFinal(
                1,
                '09:30:01.000',
                '09:30:02.840',
                '实时语音翻译',
                'Real-time speech translation',
            ),
        ])

    def test_packetizes_100ms_frames_and_flushes_tail_on_stop(self):
        clients = []

        def factory(config, response, failure, close):
            client = FakeClient(response)
            clients.append(client)
            return client

        provider = TencentSpeechTranslateProvider(
            options(), client_factory=factory
        )
        provider.start()
        provider.drain_events()
        provider.accept_audio(frame(b'a' * 3200))
        self.assertEqual(clients[0].sent, [])
        provider.accept_audio(frame(b'b' * 3200))
        self.assertEqual(clients[0].sent, [b'a' * 3200 + b'b' * 3200])
        provider.accept_audio(frame(b'c' * 1000))
        provider.stop()

        self.assertEqual(clients[0].sent[-1], b'c' * 1000)
        self.assertTrue(clients[0].stopped)
        self.assertIsInstance(provider.drain_events()[-1], ProviderStopped)

    def test_deduplicates_final_and_sanitizes_start_failure(self):
        client = None

        def factory(config, response, failure, close):
            nonlocal client
            client = FakeClient(response)
            return client

        provider = TencentSpeechTranslateProvider(
            options(), client_factory=factory
        )
        provider.start()
        provider.drain_events()
        result = {
            'code': 0,
            'sentence_id': 'sentence-1',
            'result': {
                'source_text': '完成',
                'target_text': 'Done',
                'start_time': 0,
                'end_time': 500,
                'sentence_end': True,
            },
        }
        client.response_handler(result)
        client.response_handler(result)
        self.assertEqual(len(provider.drain_events()), 1)

        failed = TencentSpeechTranslateProvider(
            options(),
            client_factory=lambda config, response, failure, close: (
                FakeClient(response, fail_start=True)
            ),
        )
        failed.start()
        error = failed.drain_events()[0]
        self.assertIsInstance(error, ProviderError)
        self.assertNotIn('secret-key', str(error))

        class HandshakeFailureClient(FakeClient):
            def start(self):
                self.response_handler({'code': 4001})
                raise ConnectionError('handshake rejected')

        handshake_failure = TencentSpeechTranslateProvider(
            options(),
            client_factory=lambda config, response, failure, close: (
                HandshakeFailureClient(response)
            ),
        )
        handshake_failure.start()
        errors = handshake_failure.drain_events()
        self.assertEqual(len(errors), 1)
        self.assertIsInstance(errors[0], ProviderError)

    def test_close_before_handshake_fails_before_releasing_start(self):
        close_states = []

        class ClosingWebSocketApp:
            def __init__(self, url, on_message, on_error, on_close):
                self.on_close = on_close

            def run_forever(self):
                self.on_close(self, None, 'closed before handshake')

            def close(self):
                return None

        client = None

        def handle_close():
            close_states.append((
                client._failed.is_set(),
                client._ready.is_set(),
            ))

        client = _WebSocketClient(
            options(),
            response_handler=lambda response: None,
            failure_handler=lambda error_type: None,
            close_handler=handle_close,
            start_timeout=0.1,
        )
        websocket_module = SimpleNamespace(WebSocketApp=ClosingWebSocketApp)

        with patch.dict(sys.modules, {'websocket': websocket_module}):
            with self.assertRaisesRegex(
                ConnectionError,
                'handshake failed',
            ):
                client.start()

        self.assertEqual(close_states, [(True, False)])

    def test_final_before_handshake_is_a_start_failure(self):
        failures = []
        responses = []

        class PrematureFinalWebSocketApp:
            def __init__(self, url, on_message, on_error, on_close):
                self.on_message = on_message
                self.on_close = on_close

            def run_forever(self):
                self.on_message(self, '{"code": 0, "final": 1}')
                self.on_close(self, 1000, 'finished')

            def close(self):
                return None

        client = _WebSocketClient(
            options(),
            response_handler=responses.append,
            failure_handler=failures.append,
            close_handler=lambda: None,
            start_timeout=0.1,
        )
        websocket_module = SimpleNamespace(
            WebSocketApp=PrematureFinalWebSocketApp
        )

        with patch.dict(sys.modules, {'websocket': websocket_module}):
            with self.assertRaisesRegex(
                ConnectionError,
                'handshake failed',
            ):
                client.start()

        self.assertEqual(responses, [])
        self.assertEqual(failures, ['ValueError'])

    def test_handshake_then_final_closes_without_transport_failure(self):
        failures = []
        responses = []
        unexpected_closes = []

        class SuccessfulWebSocketApp:
            def __init__(self, url, on_message, on_error, on_close):
                self.on_message = on_message
                self.on_close = on_close

            def run_forever(self):
                self.on_message(self, '{"code": 0, "message": "success"}')
                self.on_message(self, '{"code": 0, "final": 1}')
                self.on_close(self, 1000, 'finished')

            def close(self):
                return None

        client = _WebSocketClient(
            options(),
            response_handler=responses.append,
            failure_handler=failures.append,
            close_handler=lambda: unexpected_closes.append(True),
            start_timeout=0.1,
        )
        websocket_module = SimpleNamespace(WebSocketApp=SuccessfulWebSocketApp)

        with patch.dict(sys.modules, {'websocket': websocket_module}):
            client.start()

        self.assertEqual(len(responses), 2)
        self.assertEqual(failures, [])
        self.assertEqual(unexpected_closes, [])

    def test_provider_rejects_client_return_without_handshake(self):
        class SilentClient(FakeClient):
            def start(self):
                return None

        provider = TencentSpeechTranslateProvider(
            options(),
            client_factory=lambda config, response, failure, close: (
                SilentClient(response)
            ),
        )

        provider.start()

        events = provider.drain_events()
        self.assertEqual(len(events), 1)
        self.assertIsInstance(events[0], ProviderError)
        self.assertTrue(events[0].fatal)
        self.assertEqual(
            events[0].details['operation'],
            'tencent_speech.start',
        )

    def test_validates_signing_language_pairs_and_reserved_hotwords(self):
        url = build_signed_url(
            options(),
            timestamp=100,
            nonce=42,
            voice_id='voice-1',
        )
        parsed = urlparse(url)
        query = parse_qs(parsed.query)

        self.assertEqual(parsed.scheme, 'wss')
        self.assertEqual(parsed.path, '/asr/speech_translate/123456')
        self.assertEqual(query['source'], ['zh'])
        self.assertEqual(query['target'], ['en'])
        self.assertEqual(query['vad_silence_time'], ['1000'])
        self.assertIn('signature', query)
        self.assertNotIn('secret-key', url)
        self.assertEqual(
            encode_hotword_list((TencentHotword('腾讯云', 5),)),
            '腾讯云|5',
        )
        with self.assertRaisesRegex(ValueError, 'language pair'):
            build_signed_url(
                options(source_language='ru', target_language='ja'),
                timestamp=100,
                nonce=42,
                voice_id='voice-2',
            )


if __name__ == '__main__':
    unittest.main()
