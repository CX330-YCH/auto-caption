import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import (  # noqa: E402
    CaptionFinal,
    CaptionPartial,
    ProviderError,
    ProviderReady,
    UsageUpdated,
)
from protocol.output import ProtocolEventSink  # noqa: E402


class ProtocolEventSinkTests(unittest.TestCase):
    def test_maps_partial_and_final_to_legacy_caption_messages(self):
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
                'index': 3,
                'time_s': 'start',
                'time_t': 'partial',
                'text': 'hel',
                'translation': '',
            },
            {
                'command': 'caption',
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
        sink.publish(ProviderError('vosk', 'failed'))
        sink.publish(UsageUpdated('vosk', 10, 'seconds'))
        sink.warning('queue full')

        self.assertEqual(commands, [
            ('info', 'ready'),
            ('error', 'failed'),
            ('usage', '10 seconds'),
            ('warn', 'queue full'),
        ])


if __name__ == '__main__':
    unittest.main()
