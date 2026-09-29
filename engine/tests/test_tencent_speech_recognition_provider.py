import sys
import unittest
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import AudioFrame, CaptionFinal, CaptionPartial, ProviderReady  # noqa: E402
from providers.tencent_speech_recognition import (  # noqa: E402
    TencentRecognitionOptions,
    TencentRecognitionV2Options,
    TencentSpeechRecognitionProvider,
    TencentSpeechRecognitionV2Provider,
    build_recognition_signed_url,
    build_recognition_v2_signed_url,
)


class FakeClient:
    def __init__(self, response_handler):
        self.response_handler = response_handler
        self.sent = []

    def start(self):
        self.response_handler({'code': 0, 'message': 'success', 'final': 0})

    def send_audio(self, data):
        self.sent.append(data)

    def stop(self):
        return None


def factory_for(clients):
    def factory(options, response, failure, close, diagnostic):
        client = FakeClient(response)
        clients.append(client)
        return client
    return factory


class TencentRecognitionProviderTests(unittest.TestCase):
    def test_classic_maps_slice_lifecycle_and_server_timestamps(self):
        clients = []
        provider = TencentSpeechRecognitionProvider(
            TencentRecognitionOptions('123456', 'secret-id', 'secret-key'),
            client_factory=factory_for(clients),
            clock=lambda: datetime(2026, 9, 29, 10, 0, 0),
        )
        provider.start()
        self.assertEqual(provider.drain_events(), [ProviderReady(
            'tencent_speech_recognition',
            'Tencent realtime speech recognition started.',
        )])
        clients[0].response_handler({
            'code': 0,
            'result': {
                'slice_type': 1,
                'index': 7,
                'start_time': 100,
                'end_time': 400,
                'voice_text_str': '实时',
            },
        })
        clients[0].response_handler({
            'code': 0,
            'result': {
                'slice_type': 2,
                'index': 7,
                'start_time': 100,
                'end_time': 800,
                'voice_text_str': '实时识别',
            },
        })
        self.assertEqual(provider.drain_events(), [
            CaptionPartial(1, '10:00:00.100', '10:00:00.400', '实时'),
            CaptionFinal(1, '10:00:00.100', '10:00:00.800', '实时识别'),
        ])

    def test_v2_deduplicates_snapshots_and_carries_speaker_id(self):
        clients = []
        provider = TencentSpeechRecognitionV2Provider(
            TencentRecognitionV2Options(
                '123456',
                'secret-id',
                'secret-key',
                model='16k_zh_en_speaker_2.0',
            ),
            client_factory=factory_for(clients),
            clock=lambda: datetime(2026, 9, 29, 11, 0, 0),
        )
        provider.start()
        provider.drain_events()
        partial = {
            'sentence_id': 2,
            'sentence': '你好',
            'sentence_type': 0,
            'speaker_id': 3,
            'start_time': 20,
            'end_time': 420,
        }
        clients[0].response_handler({
            'code': 0,
            'sentences': {'sentence_list': [partial]},
        })
        clients[0].response_handler({
            'code': 0,
            'sentences': {'sentence_list': [partial]},
        })
        final = {**partial, 'sentence': '你好。', 'sentence_type': 1}
        clients[0].response_handler({
            'code': 0,
            'sentences': {'sentence_list': [final]},
        })
        clients[0].response_handler({
            'code': 0,
            'sentences': {'sentence_list': [final]},
        })
        self.assertEqual(provider.drain_events(), [
            CaptionPartial(
                1, '11:00:00.020', '11:00:00.420', '你好', speaker_id=3
            ),
            CaptionFinal(
                1, '11:00:00.020', '11:00:00.420', '你好。', speaker_id=3
            ),
        ])

    def test_signed_urls_use_v2_endpoint_and_never_include_secret_key(self):
        classic = build_recognition_signed_url(
            TencentRecognitionOptions('123456', 'secret-id', 'secret-key'),
            timestamp=100,
            nonce=42,
            voice_id='voice-1',
        )
        v2 = build_recognition_v2_signed_url(
            TencentRecognitionV2Options(
                '123456', 'secret-id', 'secret-key',
                model='16k_zh_en_speaker_2.0',
                sentence_strategy=1,
            ),
            timestamp=100,
            nonce=42,
            voice_id='voice-2',
        )
        classic_url = urlparse(classic)
        v2_query = parse_qs(urlparse(v2).query)
        self.assertEqual(classic_url.path, '/asr/v2/123456')
        self.assertEqual(v2_query['speaker_diarization'], ['1'])
        self.assertEqual(v2_query['sentence_strategy'], ['1'])
        self.assertNotIn('secret-key', classic + v2)

    def test_classic_8k_model_uses_8k_audio_and_200ms_packets(self):
        clients = []
        provider = TencentSpeechRecognitionProvider(
            TencentRecognitionOptions(
                '123456', 'secret-id', 'secret-key', model='8k_zh'
            ),
            client_factory=factory_for(clients),
        )
        provider.start()
        provider.drain_events()
        provider.accept_audio(AudioFrame(
            data=b'a' * 1600,
            sample_rate=8000,
            channels=1,
            sample_width=2,
            captured_at=1.0,
        ))
        provider.accept_audio(AudioFrame(
            data=b'b' * 1600,
            sample_rate=8000,
            channels=1,
            sample_width=2,
            captured_at=1.1,
        ))
        self.assertEqual(clients[0].sent, [b'a' * 1600 + b'b' * 1600])


if __name__ == '__main__':
    unittest.main()
