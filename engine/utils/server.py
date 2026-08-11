import socket
import threading
from protocol import NDJSONDecoder
from utils import shared_data, stdout_cmd, stderr


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
        stderr(f'Communication error: {error}')
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
        if not isinstance(message, dict) or not isinstance(message.get('command'), str):
            stderr('Command protocol message must be an object with a string command')
            continue
        if message['command'] == 'stop':
            shared_data.status = 'stop'
            return True
    return False


def start_server(port: int):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server.bind(('localhost', port))
        server.listen(1)
    except Exception as e:
        stderr(str(e))
        stdout_cmd('kill')
        return
    stdout_cmd('connect')

    client, _ = server.accept()
    server.close()
    client_handler = threading.Thread(target=handle_client, args=(client,))
    client_handler.daemon = True
    client_handler.start()
