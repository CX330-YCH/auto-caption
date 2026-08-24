import socket
import threading
import json

from core import exception_diagnostic
from protocol import NDJSONDecoder
from utils import shared_data, stderr, stdout_cmd


def handle_client(client_socket):
    global shared_data
    decoder = NDJSONDecoder()
    try:
        while shared_data.status == 'running':
            chunk = client_socket.recv(4096)
            if not chunk:
                _handle_batch(decoder.finish())
                break
            if _handle_batch(decoder.push(chunk)):
                break
    except OSError as error:
        _stderr_exception('command_server.client', error)
    finally:
        shared_data.status = 'stop'
        client_socket.close()


def _handle_batch(batch):
    global shared_data
    for error in batch.errors:
        stderr(
            f'Command protocol {error.kind} at line '
            f'{error.line_number}: {error.message}'
        )

    for message in batch.messages:
        if (
            not isinstance(message, dict)
            or not isinstance(message.get('command'), str)
        ):
            stderr(
                'Command protocol message must be an object '
                'with a string command'
            )
            continue
        if message['command'] == 'stop':
            shared_data.status = 'stop'
            return True
        if message['command'] == 'debug_mode':
            shared_data.set_debug_mode(message.get('content') == 'enabled')
    return False


def start_server(port: int):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server.bind(('localhost', port))
        server.listen(1)
    except Exception as error:
        server.close()
        _stderr_exception('command_server.start', error)
        stdout_cmd('kill')
        return
    stdout_cmd('connect')

    client, _ = server.accept()
    server.close()
    client_handler = threading.Thread(target=handle_client, args=(client,))
    client_handler.daemon = True
    client_handler.start()


def _stderr_exception(operation: str, error: Exception) -> None:
    stderr(json.dumps({
        'source': 'engine-command-server',
        'diagnostic': exception_diagnostic(
            error,
            operation=operation,
        ),
    }, ensure_ascii=False))
