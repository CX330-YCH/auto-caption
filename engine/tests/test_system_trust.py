import subprocess
import sys
import unittest
from pathlib import Path


ENGINE_ROOT = Path(__file__).resolve().parents[1]


class SystemTrustTests(unittest.TestCase):
    def test_injects_native_context_before_network_clients(self):
        script = f'''
import ssl
import sys
sys.path.insert(0, {str(ENGINE_ROOT)!r})
import truststore
from system_trust import initialize_system_trust

backend = initialize_system_trust()
initialize_system_trust()
context = ssl.create_default_context()
assert ssl.SSLContext is truststore.SSLContext
assert isinstance(context, truststore.SSLContext)
assert backend in (
    'macOS Security',
    'Windows CryptoAPI',
    'OpenSSL system paths',
)
'''
        result = subprocess.run(
            [sys.executable, '-c', script],
            capture_output=True,
            check=False,
            text=True,
            timeout=10,
        )

        self.assertEqual(
            result.returncode,
            0,
            msg=result.stderr or result.stdout,
        )

    def test_main_import_initializes_system_trust(self):
        script = f'''
import ssl
import sys
sys.path.insert(0, {str(ENGINE_ROOT)!r})
import truststore
import main
import aiohttp.connector

assert ssl.SSLContext is truststore.SSLContext
assert isinstance(
    aiohttp.connector._SSL_CONTEXT_VERIFIED,
    truststore.SSLContext,
)
assert main.SYSTEM_TRUST_BACKEND in (
    'macOS Security',
    'Windows CryptoAPI',
    'OpenSSL system paths',
)
'''
        result = subprocess.run(
            [sys.executable, '-c', script],
            capture_output=True,
            check=False,
            text=True,
            timeout=10,
        )

        self.assertEqual(
            result.returncode,
            0,
            msg=result.stderr or result.stdout,
        )


if __name__ == '__main__':
    unittest.main()
