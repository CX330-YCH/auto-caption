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
        translation_model='ollama',
        translation_model_name='',
        translation_url='',
        translation_api_key='dummy-translation-credential',
        gummy_api_key='dummy-gummy-credential',
        vosk_model_path='model',
        sosv_model_path='model',
        glm_url='https://example.test/asr',
        glm_model='glm-asr',
        glm_api_key='dummy-glm-credential',
    )


class ProviderRegistryTests(unittest.TestCase):
    def test_default_registry_contains_each_existing_provider_once(self):
        registry = build_provider_registry()

        self.assertEqual(registry.names, ('gummy', 'vosk', 'sosv', 'glm'))

    def test_rejects_unknown_and_duplicate_provider_names(self):
        registry = ProviderRegistry()
        registry.register('fake', lambda options, source, warning: None)

        with self.assertRaisesRegex(ValueError, 'already registered'):
            registry.register('fake', lambda options, source, warning: None)
        with self.assertRaisesRegex(ValueError, 'Invalid caption engine'):
            registry.create(config('missing'), object(), lambda message: None)

    def test_provider_config_repr_does_not_expose_credentials(self):
        representation = repr(config('gummy'))

        self.assertNotIn('dummy-translation-credential', representation)
        self.assertNotIn('dummy-gummy-credential', representation)
        self.assertNotIn('dummy-glm-credential', representation)


if __name__ == '__main__':
    unittest.main()
