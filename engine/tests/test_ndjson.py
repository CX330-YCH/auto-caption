import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from protocol import NDJSONDecoder  # noqa: E402


class NDJSONDecoderTests(unittest.TestCase):
    def test_decodes_multiple_messages_and_ignores_blank_lines(self):
        decoder = NDJSONDecoder()

        batch = decoder.push(
            b'{"command":"stop"}\r\n\n{"command":"noop"}\n'
        )

        self.assertEqual(batch.errors, [])
        self.assertEqual(batch.messages, [
            {'command': 'stop'},
            {'command': 'noop'}
        ])

    def test_buffers_json_and_utf8_across_recv_boundaries(self):
        decoder = NDJSONDecoder()
        encoded = '{"command":"noop","content":"字幕"}\n'.encode('utf-8')
        split_at = encoded.index('字'.encode('utf-8')) + 1

        first = decoder.push(encoded[:split_at])
        second = decoder.push(encoded[split_at:])

        self.assertEqual(first.messages, [])
        self.assertEqual(second.errors, [])
        self.assertEqual(second.messages[0]['content'], '字幕')

    def test_reports_malformed_lines_and_recovers(self):
        decoder = NDJSONDecoder()

        batch = decoder.push(b'not-json\n{"command":"stop"}\n')

        self.assertEqual(len(batch.errors), 1)
        self.assertEqual(batch.errors[0].kind, 'invalid-json')
        self.assertEqual(batch.errors[0].line_number, 1)
        self.assertEqual(batch.messages, [{'command': 'stop'}])

    def test_reports_invalid_utf8_without_echoing_payload(self):
        decoder = NDJSONDecoder()

        batch = decoder.push(b'{"content":"\xff"}\n{"command":"stop"}\n')

        self.assertEqual(batch.errors[0].kind, 'invalid-utf8')
        self.assertNotIn('content', batch.errors[0].message)
        self.assertEqual(batch.messages, [{'command': 'stop'}])

    def test_accepts_legacy_trailing_json_at_end_of_stream(self):
        decoder = NDJSONDecoder()

        decoder.push(b'{"command":"stop"}')
        batch = decoder.finish()

        self.assertEqual(batch.errors, [])
        self.assertEqual(batch.messages, [{'command': 'stop'}])

    def test_bounds_oversized_line_and_recovers_after_delimiter(self):
        decoder = NDJSONDecoder(max_line_length=32)

        oversized = decoder.push(
            b'{"content":"012345678901234567890123456789'
        )
        recovered = decoder.push(
            b'continued"}\n{"command":"stop"}\n'
        )

        self.assertEqual(oversized.errors[0].kind, 'line-too-long')
        self.assertEqual(recovered.errors, [])
        self.assertEqual(recovered.messages, [{'command': 'stop'}])

    def test_reset_discards_pending_data(self):
        decoder = NDJSONDecoder()

        decoder.push(b'partial')
        decoder.reset()
        batch = decoder.push(b'{"command":"stop"}\n')

        self.assertEqual(batch.messages, [{'command': 'stop'}])


if __name__ == '__main__':
    unittest.main()
