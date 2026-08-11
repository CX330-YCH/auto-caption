from .audioprcs import merge_chunk_channels, resample_chunk_mono
from .sysout import stdout, stdout_err, stdout_cmd, stdout_obj, stderr
from .sysout import change_caption_display
from .shared import shared_data
from .translation import ollama_translate, google_translate


def start_server(port: int):
    """Compatibility entry point; new code imports protocol.server directly."""
    from protocol.server import start_server as protocol_start_server

    return protocol_start_server(port)
