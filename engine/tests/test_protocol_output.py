import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderDebug,
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


if __name__ == '__main__':
    unittest.main()
