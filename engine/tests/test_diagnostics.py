import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_ROOT))

from core import exception_diagnostic, sdk_diagnostic  # noqa: E402
from core import redact_diagnostic_text  # noqa: E402


class FakeSdkResult:
    def __init__(self):
        self.status_code = 401
        self.code = 'InvalidApiKey'
        self.message = 'Rejected dummy-credential'
        self.request_id = 'request-123'
        self.api_key = 'dummy-credential'
        self.payload = {
            'authorization': 'Bearer another-secret',
            'audio': b'\x00' * 128,
        }


class DiagnosticTests(unittest.TestCase):
    def test_redacts_cookie_and_non_bearer_authorization_text(self):
        self.assertEqual(
            redact_diagnostic_text('Authorization: Basic dXNlcjpwYXNz'),
            'Authorization: Basic <redacted>',
        )
        self.assertEqual(
            redact_diagnostic_text('Cookie: session=private-value'),
            'Cookie: <redacted>',
        )

    def test_preserves_exception_traceback_attributes_and_cause(self):
        try:
            try:
                raise ValueError('inner failure')
            except ValueError as cause:
                error = RuntimeError(
                    'request failed for dummy-credential'
                )
                error.status_code = 503
                raise error from cause
        except RuntimeError as error:
            details = exception_diagnostic(
                error,
                operation='provider.test',
                secrets=('dummy-credential',),
            )

        self.assertEqual(details['operation'], 'provider.test')
        self.assertEqual(details['errorType'], 'RuntimeError')
        self.assertEqual(details['errorAttributes']['status_code'], 503)
        self.assertEqual(details['cause']['errorType'], 'ValueError')
        self.assertIn('raise error from cause', details['stackTrace'])
        self.assertNotIn('dummy-credential', str(details))

    def test_preserves_sdk_fields_and_summarizes_binary_payloads(self):
        details = sdk_diagnostic(
            FakeSdkResult(),
            operation='sdk.callback.on_error',
            secrets=('dummy-credential',),
        )
        attributes = details['sdkResult']['attributes']

        self.assertEqual(attributes['status_code'], 401)
        self.assertEqual(attributes['code'], 'InvalidApiKey')
        self.assertEqual(attributes['request_id'], 'request-123')
        self.assertEqual(attributes['api_key'], '<redacted>')
        self.assertEqual(
            attributes['payload']['audio'],
            {'type': 'bytes', 'length': 128},
        )
        self.assertNotIn('dummy-credential', str(details))
        self.assertNotIn('another-secret', str(details))


if __name__ == '__main__':
    unittest.main()
