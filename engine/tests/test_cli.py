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
        self.assertEqual(options.fun_asr_model, 'fun-asr-realtime')
        self.assertEqual(options.fun_asr_max_sentence_silence, 1300)
        self.assertTrue(options.fun_asr_heartbeat)
        self.assertEqual(options.fun_asr_vocabulary_id, '')
        self.assertEqual(options.fun_asr_context_terms, ())

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

    def test_parses_fun_asr_arguments_and_hides_credentials(self):
        options = parse_args([
            '-e', 'fun_asr',
            '-fworkspace', 'workspace-1',
            '-furl', (
                'wss://workspace-1.cn-beijing.maas.aliyuncs.com/'
                'api-ws/v1/inference'
            ),
            '-fkey', 'dummy-fun-asr-credential',
            '-fsemantic', '1',
            '-fsilence', '800',
            '-fheartbeat', '0',
            '-fvocabulary', 'vocab-project-1',
            '-fvmodel', 'fun-asr-realtime',
            '-fcontext', 'Auto Caption',
            '-fcontext', '阿里云百炼',
        ])

        self.assertEqual(options.caption_engine, 'fun_asr')
        self.assertEqual(options.fun_asr_workspace, 'workspace-1')
        self.assertTrue(options.fun_asr_semantic_punctuation)
        self.assertEqual(options.fun_asr_max_sentence_silence, 800)
        self.assertFalse(options.fun_asr_heartbeat)
        self.assertEqual(options.fun_asr_vocabulary_id, 'vocab-project-1')
        self.assertEqual(
            options.fun_asr_context_terms,
            ('Auto Caption', '阿里云百炼'),
        )
        self.assertNotIn('dummy-fun-asr-credential', repr(options))


if __name__ == '__main__':
    unittest.main()
