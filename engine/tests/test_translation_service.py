import sys
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import patch


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import CaptionFinal  # noqa: E402
from translation import (  # noqa: E402
    TranslationProvider,
    TranslationProviderConfig,
    TranslationProviderRegistry,
    TranslationRequest,
    TranslationResult,
    TranslationSession,
    build_translation_provider_registry,
)
from translation.providers import (  # noqa: E402
    GoogleTranslationProvider,
    OllamaTranslationProvider,
)


def caption(caption_id):
    return CaptionFinal(caption_id, 'start', 'end', f'text-{caption_id}')


class FakeTranslationProvider(TranslationProvider):
    def __init__(self, *, block_first=False, error=None, secret=''):
        self.requests = []
        self.started = False
        self.stopped = False
        self.block_first = block_first
        self.error = error
        self.secret = secret
        self.first_started = threading.Event()
        self.release_first = threading.Event()
        self.finished = threading.Event()
        self.second_finished = threading.Event()

    @property
    def name(self):
        return 'fake'

    @property
    def secrets(self):
        return (self.secret,)

    def start(self):
        self.started = True

    def translate(self, request):
        self.requests.append(request)
        if self.block_first and request.caption_id == 1:
            self.first_started.set()
            self.release_first.wait(timeout=1)
        if self.error:
            self.finished.set()
            raise self.error
        self.finished.set()
        if request.caption_id == 2:
            self.second_finished.set()
        return TranslationResult(
            caption_id=request.caption_id,
            source_text=request.text,
            translated_text=f'translated-{request.caption_id}',
            started_at=request.started_at,
            provider=self.name,
            target_language=request.target_language,
        )

    def stop(self):
        self.stopped = True


class TranslationSessionTests(unittest.TestCase):
    def test_provider_lifecycle_and_stable_caption_result(self):
        provider = FakeTranslationProvider()
        results = []
        service = TranslationSession(
            provider=provider,
            source_language='en',
            target_language='zh',
            result_handler=results.append,
            warning_handler=self.fail,
            worker_count=1,
        )

        service.start()
        service.submit(caption(42))
        self.assertTrue(provider.finished.wait(timeout=1))
        service.close()

        self.assertTrue(provider.started)
        self.assertTrue(provider.stopped)
        self.assertEqual(provider.requests, [TranslationRequest(
            caption_id=42,
            source_language='en',
            target_language='zh',
            text='text-42',
            started_at='start',
        )])
        self.assertEqual(results[0].caption_id, 42)
        self.assertEqual(results[0].translated_text, 'translated-42')

    def test_bounds_pending_work_and_warns_when_queue_is_full(self):
        provider = FakeTranslationProvider(block_first=True)
        warnings = []
        service = TranslationSession(
            provider=provider,
            source_language='en',
            target_language='zh',
            result_handler=lambda result: None,
            warning_handler=warnings.append,
            worker_count=1,
            max_pending=1,
        )
        service.start()
        service.submit(caption(1))
        self.assertTrue(provider.first_started.wait(timeout=1))
        service.submit(caption(2))
        service.submit(caption(3))
        provider.release_first.set()
        self.assertTrue(provider.second_finished.wait(timeout=1))
        service.close()

        self.assertEqual(
            [request.caption_id for request in provider.requests],
            [1, 2],
        )
        self.assertEqual(len(warnings), 1)
        self.assertIn('queue is full', warnings[0])

    def test_preserves_sanitized_translation_exception_diagnostic(self):
        provider = FakeTranslationProvider(
            error=RuntimeError('API key translation-secret rejected'),
            secret='translation-secret',
        )
        warnings = []
        diagnostics = []
        diagnostic_finished = threading.Event()

        def collect_diagnostic(message, details):
            diagnostics.append((message, details))
            diagnostic_finished.set()

        service = TranslationSession(
            provider=provider,
            source_language='en',
            target_language='zh',
            result_handler=self.fail,
            warning_handler=warnings.append,
            diagnostic_handler=collect_diagnostic,
            worker_count=1,
        )
        service.start()
        service.submit(caption(1))
        self.assertTrue(diagnostic_finished.wait(timeout=1))
        service.close()

        self.assertEqual(len(warnings), 1)
        self.assertEqual(diagnostics[0][1]['operation'], 'translation.request')
        self.assertEqual(diagnostics[0][1]['errorType'], 'RuntimeError')
        self.assertIn('stackTrace', diagnostics[0][1])
        self.assertNotIn('translation-secret', str(diagnostics))


class TranslationProviderRegistryTests(unittest.TestCase):
    def test_default_registry_contains_existing_translation_engines(self):
        self.assertEqual(
            build_translation_provider_registry().names,
            ('google', 'ollama'),
        )

    def test_rejects_unknown_and_duplicate_provider_names(self):
        registry = TranslationProviderRegistry()
        registry.register('fake', lambda config: FakeTranslationProvider())

        with self.assertRaisesRegex(ValueError, 'already registered'):
            registry.register(
                'fake',
                lambda config: FakeTranslationProvider(),
            )
        with self.assertRaisesRegex(ValueError, 'Invalid translation engine'):
            registry.create(TranslationProviderConfig(name='missing'))

    def test_translation_config_repr_does_not_expose_credentials(self):
        representation = repr(TranslationProviderConfig(
            name='ollama',
            api_key='translation-secret',
        ))

        self.assertNotIn('translation-secret', representation)


class ExistingTranslationProviderTests(unittest.TestCase):
    def test_google_provider_passes_the_selected_target_language(self):
        calls = []

        class Translator:
            async def translate(self, text, dest):
                calls.append((text, dest))
                return types.SimpleNamespace(text='你好')

        googletrans = types.ModuleType('googletrans')
        googletrans.Translator = Translator
        request = TranslationRequest(7, 'en', 'zh', 'hello', 'start')

        with patch.dict(sys.modules, {'googletrans': googletrans}):
            result = GoogleTranslationProvider().translate(request)

        self.assertEqual(calls, [('hello', 'zh')])
        self.assertEqual(result.caption_id, 7)
        self.assertEqual(result.translated_text, '你好')
        self.assertEqual(result.target_language, 'zh')

    def test_ollama_provider_preserves_prompt_and_strips_thinking(self):
        calls = []

        def chat(*, model, messages):
            calls.append((model, messages))
            return types.SimpleNamespace(message=types.SimpleNamespace(
                content='<think>internal</think> 你好 '
            ))

        ollama = types.ModuleType('ollama')
        ollama.chat = chat
        request = TranslationRequest(8, 'en', 'zh', 'hello', 'start')

        with patch.dict(sys.modules, {'ollama': ollama}):
            result = OllamaTranslationProvider('test-model').translate(request)

        self.assertEqual(calls[0][0], 'test-model')
        self.assertIn('Translate the following content into Chinese', calls[0][1][0]['content'])
        self.assertEqual(calls[0][1][1]['content'], 'hello')
        self.assertEqual(result.translated_text, '你好')
        self.assertEqual(result.caption_id, 8)


if __name__ == '__main__':
    unittest.main()
