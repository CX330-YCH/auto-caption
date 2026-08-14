import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from services.hotwords import (  # noqa: E402
    HotwordConnection,
    HotwordModelMismatchError,
    HotwordRuntimeConfig,
    HotwordService,
    run_hotword_worker,
)


class FakeVocabularyClient:
    def __init__(self):
        self.resources = {
            'vocab-project-1': {
                'target_model': 'fun-asr-realtime',
                'status': 'OK',
                'gmt_create': '2026-08-12',
                'gmt_modified': '2026-08-12',
                'vocabulary': [
                    {'text': 'Auto Caption', 'weight': 4, 'lang': 'en'},
                ],
            },
            'vocab-snapshot-1': {
                'target_model': 'fun-asr-realtime-2025-11-07',
                'status': 'OK',
                'gmt_create': '2026-08-12',
                'gmt_modified': '2026-08-12',
                'vocabulary': [
                    {'text': '阿里云百炼', 'weight': 4, 'lang': 'zh'},
                ],
            },
        }
        self.updated = None
        self.deleted = None

    def create_vocabulary(self, target_model, prefix, vocabulary):
        self.created = (target_model, prefix, vocabulary)
        return 'vocab-created-1'

    def list_vocabularies(self, prefix=None, page_index=0, page_size=10):
        return [{
            'vocabulary_id': 'vocab-project-1',
            'status': 'OK',
            'gmt_create': '2026-08-12',
            'gmt_modified': '2026-08-12',
        }]

    def query_vocabulary(self, vocabulary_id):
        return self.resources[vocabulary_id]

    def update_vocabulary(self, vocabulary_id, vocabulary):
        self.updated = (vocabulary_id, vocabulary)

    def delete_vocabulary(self, vocabulary_id):
        self.deleted = vocabulary_id


def connection():
    return HotwordConnection(
        workspace_id='workspace-1',
        websocket_url=(
            'wss://workspace-1.cn-beijing.maas.aliyuncs.com/'
            'api-ws/v1/inference'
        ),
        model='fun-asr-realtime',
        api_key='dummy-credential',
    )


class HotwordRuntimeTests(unittest.TestCase):
    def test_builds_vocabulary_and_context_start_options(self):
        runtime = HotwordRuntimeConfig(
            vocabulary_id='vocab-project-1',
            target_model='fun-asr-realtime',
            context_terms=('Auto Caption', '阿里云百炼'),
        )

        client_options = runtime.recognition_client_options(
            'fun-asr-realtime'
        )
        start_options = runtime.recognition_start_options(
            'fun-asr-realtime'
        )

        self.assertEqual(client_options['vocabulary_id'], 'vocab-project-1')
        self.assertEqual(
            start_options['raw_input']['context'][0]['content'][0]['text'],
            'Auto Caption\n阿里云百炼',
        )

    def test_rejects_model_mismatch_and_oversized_context(self):
        with self.assertRaisesRegex(ValueError, 'model mismatch'):
            HotwordRuntimeConfig(
                vocabulary_id='vocab-project-1',
                target_model='fun-asr-realtime-2025-11-07',
            ).recognition_start_options('fun-asr-realtime')
        with self.assertRaisesRegex(ValueError, 'context terms'):
            HotwordRuntimeConfig(
                context_terms=('x' * 100, 'y' * 100, 'z' * 100, 'w' * 100),
            ).recognition_start_options('fun-asr-realtime')


class HotwordManagerTests(unittest.TestCase):
    def setUp(self):
        self.client = FakeVocabularyClient()
        self.service = HotwordService(
            connection(),
            client_factory=lambda config, url: self.client,
        )

    def test_lists_queries_creates_updates_and_deletes(self):
        listed = self.service.execute({
            'action': 'list',
            'prefix': '',
            'pageIndex': 0,
            'pageSize': 10,
        })
        self.assertEqual(listed[0]['vocabularyId'], 'vocab-project-1')

        queried = self.service.execute({
            'action': 'query',
            'vocabularyId': 'vocab-project-1',
        })
        self.assertEqual(queried['targetModel'], 'fun-asr-realtime')
        self.assertEqual(queried['vocabulary'][0]['weight'], 4)

        created = self.service.execute({
            'action': 'create',
            'prefix': 'project1',
            'vocabulary': [{'text': 'Auto Caption', 'weight': 4}],
        })
        self.assertEqual(created['vocabularyId'], 'vocab-created-1')
        self.assertEqual(self.client.created[0], 'fun-asr-realtime')

        self.service.execute({
            'action': 'update',
            'vocabularyId': 'vocab-project-1',
            'vocabulary': [{'text': '阿里云百炼', 'weight': 5, 'lang': 'zh'}],
        })
        self.assertEqual(self.client.updated[0], 'vocab-project-1')

        self.service.execute({
            'action': 'delete',
            'vocabularyId': 'vocab-project-1',
        })
        self.assertEqual(self.client.deleted, 'vocab-project-1')

    def test_refuses_mutation_when_remote_target_model_differs(self):
        with self.assertRaises(HotwordModelMismatchError):
            self.service.execute({
                'action': 'delete',
                'vocabularyId': 'vocab-snapshot-1',
            })

    def test_worker_returns_sanitized_errors_without_credentials(self):
        class FailingClient(FakeVocabularyClient):
            def list_vocabularies(self, **kwargs):
                raise RuntimeError('dummy-credential remote response')

        envelope = {
            'workspaceId': 'workspace-1',
            'websocketUrl': (
                'wss://workspace-1.cn-beijing.maas.aliyuncs.com/'
                'api-ws/v1/inference'
            ),
            'model': 'fun-asr-realtime',
            'apiKey': 'dummy-credential',
            'request': {
                'action': 'list',
                'prefix': '',
                'pageIndex': 0,
                'pageSize': 10,
            },
        }
        output = io.StringIO()
        diagnostic_output = io.StringIO()
        with patch(
            'services.hotwords._build_vocabulary_client',
            return_value=FailingClient(),
        ):
            code = run_hotword_worker(
                io.StringIO(json.dumps(envelope)),
                output,
                diagnostic_output,
            )

        self.assertEqual(code, 1)
        self.assertEqual(
            json.loads(output.getvalue()),
            {'ok': False, 'errorCode': 'sdk_error'},
        )
        self.assertNotIn('dummy-credential', output.getvalue())
        diagnostic = json.loads(diagnostic_output.getvalue())
        self.assertEqual(diagnostic['source'], 'hotword-worker')
        self.assertEqual(
            diagnostic['diagnostic']['operation'],
            'fun_asr.hotword.worker',
        )
        self.assertEqual(
            diagnostic['diagnostic']['errorType'],
            'RuntimeError',
        )
        self.assertIn('stackTrace', diagnostic['diagnostic'])
        self.assertNotIn('dummy-credential', diagnostic_output.getvalue())


if __name__ == '__main__':
    unittest.main()
