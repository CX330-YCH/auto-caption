import threading
from queue import Queue

from cli import CliOptions, parse_args
from core import AudioCaptureWorker, RecognitionSession
from protocol.output import ProtocolEventSink
from protocol.server import start_server
from providers import ProviderConfig, build_provider_registry
from utils import change_caption_display, shared_data, stdout, stdout_cmd
from sysaudio import AudioStream


def run(options: CliOptions) -> None:
    if options.port != 0:
        threading.Thread(
            target=start_server,
            args=(options.port,),
            daemon=True,
        ).start()
    if options.display_caption == 1:
        change_caption_display(True)

    output = ProtocolEventSink()
    audio_source = AudioStream(options.audio_type, options.chunk_rate)
    runtime = build_provider_registry().create(
        _provider_config(options),
        audio_source,
        output.warning,
    )
    audio_queue = Queue(maxsize=max(10, options.chunk_rate * 5))
    request_stop = lambda: setattr(shared_data, 'status', 'kill')
    is_running = lambda: shared_data.status == 'running'
    capture = AudioCaptureWorker(
        source=audio_source,
        pipeline=runtime.audio_pipeline,
        output_queue=audio_queue,
        is_running=is_running,
        request_stop=request_stop,
        info_handler=lambda message: stdout_cmd('info', message),
        error_handler=lambda message: stdout_cmd('error', message),
        record=options.record,
        recording_path=options.record_path,
    )
    capture_thread = threading.Thread(target=capture.run, daemon=True)
    session = RecognitionSession(
        provider=runtime.provider,
        audio_queue=audio_queue,
        audio_source=audio_source,
        event_sink=output,
        translation_service=runtime.translation_service,
        start_audio_capture=capture_thread.start,
        is_running=is_running,
        request_stop=request_stop,
    )
    try:
        session.run()
    except KeyboardInterrupt:
        shared_data.status = 'stop'
        stdout('Keyboard interrupt detected. Exiting...')

    if shared_data.status == 'kill':
        stdout_cmd('kill')


def _provider_config(options: CliOptions) -> ProviderConfig:
    return ProviderConfig(
        name=options.caption_engine,
        source_language=options.source_language,
        target_language=options.target_language,
        translation_model=options.translation_model,
        translation_model_name=options.ollama_name,
        translation_url=options.ollama_url,
        translation_api_key=options.ollama_api_key,
        gummy_api_key=options.api_key,
        vosk_model_path=options.vosk_model,
        sosv_model_path=options.sosv_model,
        glm_url=options.glm_url,
        glm_model=options.glm_model,
        glm_api_key=options.glm_api_key,
    )


if __name__ == '__main__':
    run(parse_args())
