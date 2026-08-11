"""Compatibility import for the server moved to protocol.server."""

from protocol.server import handle_client, start_server

__all__ = ['handle_client', 'start_server']
