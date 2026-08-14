import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import CaptionFinal  # noqa: E402
from services import (  # noqa: E402
    QueuedTranslationService,
    build_legacy_translation_service,
)


def caption(caption_id):
    return CaptionFinal(caption_id, 'start', 'end', f'text-{caption_id}')


class QueuedTranslationServiceTests(unittest.TestCase):
    def test_bounds_pending_work_and_warns_when_queue_is_full(self):
        first_started = threading.Event()
        release_first = threading.Event()
        second_finished = threading.Event()
        translated = []
        warnings = []

        def translate(item):
            translated.append(item.caption_id)
            if item.caption_id == 1:
                first_started.set()
                release_first.wait(timeout=1)
            if item.caption_id == 2:
                second_finished.set()

        service = QueuedTranslationService(
            translator=translate,
            warning_handler=warnings.append,
            worker_count=1,
            max_pending=1,
        )
        service.submit(caption(1))
        self.assertTrue(first_started.wait(timeout=1))
        service.submit(caption(2))
        service.submit(caption(3))
        release_first.set()
        self.assertTrue(second_finished.wait(timeout=1))
        service.close()

        self.assertEqual(translated, [1, 2])
        self.assertEqual(len(warnings), 1)
        self.assertIn('queue is full', warnings[0])

    def test_legacy_translation_output_receives_stable_caption_id(self):
        translated = threading.Event()
        calls = []

        def fake_translate(*args):
            calls.append(args)
            translated.set()

        with patch('utils.translation.ollama_translate', fake_translate):
            service = build_legacy_translation_service(
                target='zh',
                trans_model='ollama',
                model_name='test-model',
                url='http://localhost:11434',
                api_key='',
                warning_handler=self.fail,
            )
            service.submit(caption(42))
            self.assertTrue(translated.wait(timeout=1))
            service.close()

        self.assertEqual(calls, [(
            'test-model',
            'zh',
            'text-42',
            'start',
            42,
            'http://localhost:11434',
            '',
        )])


if __name__ == '__main__':
    unittest.main()
