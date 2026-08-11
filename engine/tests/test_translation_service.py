import sys
import threading
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import CaptionFinal  # noqa: E402
from services import QueuedTranslationService  # noqa: E402


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


if __name__ == '__main__':
    unittest.main()
