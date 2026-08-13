import platform

import truststore


_initialized = False


def initialize_system_trust() -> str:
    """Route Python TLS verification through the native OS trust store."""
    global _initialized
    if not _initialized:
        truststore.inject_into_ssl()
        _initialized = True
    return _backend_name()


def _backend_name() -> str:
    system = platform.system()
    if system == 'Darwin':
        return 'macOS Security'
    if system == 'Windows':
        return 'Windows CryptoAPI'
    return 'OpenSSL system paths'
