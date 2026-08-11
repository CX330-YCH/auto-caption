import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from cli import parse_args  # noqa: E402


class CliTests(unittest.TestCase):
    def test_preserves_existing_defaults(self):
        options = parse_args([])

        self.assertEqual(options.caption_engine, 'gummy')
        self.assertEqual(options.audio_type, 0)
        self.assertEqual(options.chunk_rate, 10)
        self.assertEqual(options.target_language, 'none')
        self.assertFalse(options.record)
        self.assertEqual(options.glm_model, 'glm-asr-2512')

    def test_parses_existing_provider_arguments_and_hides_credentials_in_repr(self):
        options = parse_args([
            '-e', 'glm',
            '-a', '1',
            '-c', '20',
            '-r', '1',
            '-gurl', 'https://example.test/asr',
            '-gkey', 'dummy-credential',
        ])

        self.assertEqual(options.caption_engine, 'glm')
        self.assertEqual(options.audio_type, 1)
        self.assertEqual(options.chunk_rate, 20)
        self.assertTrue(options.record)
        self.assertEqual(options.glm_url, 'https://example.test/asr')
        self.assertNotIn('dummy-credential', repr(options))


if __name__ == '__main__':
    unittest.main()
