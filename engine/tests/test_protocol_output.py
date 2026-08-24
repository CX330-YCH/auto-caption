import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    CaptionFinal,
    CaptionPartial,
    CaptionRevoked,
    ProviderError,
    ProviderDebug,
    ProviderMetric,
    ProviderInfo,
    ProviderReady,
    UsageUpdated,
)
from protocol.output import ProtocolEventSink  # noqa: E402


class ProtocolEventSinkTests(unittest.TestCase):
    def test_maps_partial_and_final_to_versioned_caption_messages(self):
        commands = []
        objects = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: commands.append(
                (command, content)
            ),
            object_writer=objects.append,
        )

        sink.publish(CaptionPartial(3, 'start', 'partial', 'hel'))
        sink.publish(CaptionFinal(3, 'start', 'final', 'hello'))

        self.assertEqual(commands, [])
        self.assertEqual(objects, [
            {
                'command': 'caption',
                'event_version': 1,
                'phase': 'partial',
                'index': 3,
                'time_s': 'start',
                'time_t': 'partial',
                'text': 'hel',
                'translation': '',
            },
            {
                'command': 'caption',
                'event_version': 1,
                'phase': 'final',
                'index': 3,
                'time_s': 'start',
                'time_t': 'final',
                'text': 'hello',
                'translation': '',
            },
        ])

    def test_maps_caption_revocation_to_additive_versioned_command(self):
        objects = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: None,
            object_writer=objects.append,
        )

        sink.publish(CaptionRevoked(9))

        self.assertEqual(objects, [{
            'command': 'caption_remove',
            'event_version': 1,
            'index': 9,
        }])

    def test_maps_lifecycle_error_usage_and_warning_commands(self):
        commands = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: commands.append(
                (command, content)
            ),
            object_writer=lambda value: None,
        )

        sink.publish(ProviderReady('vosk', 'ready'))
        sink.publish(ProviderInfo('vosk', 'working'))
        sink.publish(ProviderError('vosk', 'failed'))
        sink.publish(UsageUpdated('vosk', 10, 'seconds'))
        sink.warning('queue full')

        self.assertEqual(commands, [
            ('info', 'ready'),
            ('info', 'working'),
            ('error', 'failed'),
            ('usage', '10 seconds'),
            ('warn', 'queue full'),
        ])

    def test_preserves_provider_supplied_translation_on_caption(self):
        objects = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: None,
            object_writer=objects.append,
        )

        sink.publish(CaptionFinal(
            4,
            'start',
            'end',
            'hello',
            '你好',
        ))

        self.assertEqual(objects[0]['translation'], '你好')

    def test_maps_hidden_debug_and_versioned_error_diagnostics(self):
        objects = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: None,
            object_writer=objects.append,
        )

        sink.publish(ProviderDebug(
            'fun_asr',
            'generation failed',
            {'generation': 2},
        ))
        sink.publish(ProviderError(
            'fun_asr',
            'task failed',
            True,
            {
                'provider': 'fun_asr',
                'generation': 2,
                'code': 'InvalidApiKey',
            },
        ))

        self.assertEqual(objects, [
            {
                'command': 'debug',
                'content': 'generation failed',
                'details': {'generation': 2},
            },
            {
                'command': 'error',
                'content': 'task failed',
                'diagnostic': {
                    'version': 1,
                    'provider': 'fun_asr',
                    'generation': 2,
                    'code': 'InvalidApiKey',
                },
            },
        ])

    def test_maps_metrics_and_chunks_large_error_diagnostics(self):
        objects = []
        sink = ProtocolEventSink(
            command_writer=lambda command, content: None,
            object_writer=objects.append,
        )

        sink.publish(ProviderMetric(
            'fun_asr',
            'audio.queue',
            'snapshot',
            {'depth': 4, 'capacity': 50},
        ))
        sink.publish(ProviderError(
            'fun_asr',
            'large failure',
            True,
            {'response': 'x' * (600 * 1024)},
        ))

        self.assertEqual(objects[0], {
            'command': 'metric',
            'event_version': 1,
            'provider': 'fun_asr',
            'category': 'audio.queue',
            'name': 'snapshot',
            'fields': {'depth': 4, 'capacity': 50},
        })
        chunks = [
            item for item in objects
            if item['command'] == 'diagnostic_chunk'
        ]
        self.assertGreater(len(chunks), 1)
        self.assertEqual(objects[-1]['command'], 'error')
        self.assertIn('diagnostic_ref', objects[-1])


if __name__ == '__main__':
    unittest.main()
