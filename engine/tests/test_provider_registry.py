import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from providers import (  # noqa: E402
    ProviderConfig,
    ProviderRegistry,
    build_provider_registry,
)


def config(name):
    return ProviderConfig(
        name=name,
        source_language='auto',
        target_language='none',
        gummy_api_key='dummy-gummy-credential',
        vosk_model_path='model',
        sosv_model_path='model',
        glm_url='https://example.test/asr',
        glm_model='glm-asr',
        glm_api_key='dummy-glm-credential',
        fun_asr_model='fun-asr-realtime',
        fun_asr_url=(
            'wss://workspace-1.cn-beijing.maas.aliyuncs.com/'
            'api-ws/v1/inference'
        ),
        fun_asr_workspace='workspace-1',
        fun_asr_api_key='dummy-fun-asr-credential',
        fun_asr_semantic_punctuation=False,
        fun_asr_max_sentence_silence=1300,
        fun_asr_heartbeat=True,
        fun_asr_vocabulary_id='',
        fun_asr_vocabulary_model='fun-asr-realtime',
        fun_asr_context_terms=(),
        tencent_app_id='123456',
        tencent_secret_id='dummy-tencent-secret-id',
        tencent_secret_key='dummy-tencent-secret-key',
        tencent_model='hunyuan-translation-lite',
        tencent_vad_silence_ms=1000,
        tencent_max_speak_time_ms=10000,
    )


class ProviderRegistryTests(unittest.TestCase):
    def test_default_registry_contains_each_existing_provider_once(self):
        registry = build_provider_registry()

        self.assertEqual(
            registry.names,
            (
                'gummy', 'vosk', 'sosv', 'glm', 'fun_asr',
                'apple_speech', 'tencent_speech_translate',
            ),
        )

    def test_rejects_unknown_and_duplicate_provider_names(self):
        registry = ProviderRegistry()
        registry.register('fake', lambda options, source, warning: None)

        with self.assertRaisesRegex(ValueError, 'already registered'):
            registry.register('fake', lambda options, source, warning: None)
        with self.assertRaisesRegex(ValueError, 'Invalid caption engine'):
            registry.create(config('missing'), object(), lambda message: None)

    def test_provider_config_repr_does_not_expose_credentials(self):
        representation = repr(config('gummy'))

        self.assertNotIn('dummy-gummy-credential', representation)
        self.assertNotIn('dummy-glm-credential', representation)
        self.assertNotIn('dummy-fun-asr-credential', representation)
        self.assertNotIn('dummy-tencent-secret-id', representation)
        self.assertNotIn('dummy-tencent-secret-key', representation)


if __name__ == '__main__':
    unittest.main()
