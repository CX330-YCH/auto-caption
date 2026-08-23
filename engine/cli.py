import argparse
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CliOptions:
    caption_engine: str
    audio_type: int
    chunk_rate: int
    port: int
    display_caption: int
    target_language: str
    record: bool
    record_path: str
    source_language: str
    api_key: str = field(repr=False)
    translation_model: str = 'ollama'
    ollama_name: str = ''
    ollama_url: str = ''
    ollama_api_key: str = field(default='', repr=False)
    vosk_model: str = ''
    sosv_model: str | None = None
    glm_url: str = ''
    glm_model: str = ''
    glm_api_key: str = field(default='', repr=False)
    fun_asr_model: str = 'fun-asr-realtime'
    fun_asr_url: str = ''
    fun_asr_workspace: str = ''
    fun_asr_api_key: str = field(default='', repr=False)
    fun_asr_semantic_punctuation: bool = False
    fun_asr_max_sentence_silence: int = 1300
    fun_asr_heartbeat: bool = True
    fun_asr_vocabulary_id: str = ''
    fun_asr_vocabulary_model: str = 'fun-asr-realtime'
    fun_asr_context_terms: tuple[str, ...] = ()
    apple_speech_helper: str = ''


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Convert system audio stream to text'
    )
    parser.add_argument(
        '-e', '--caption_engine', default='gummy',
        help='Caption engine: gummy, glm, vosk, sosv, fun_asr or apple_speech'
    )
    parser.add_argument(
        '-a', '--audio_type', type=int, default=0,
        help='Audio stream source: 0 for output, 1 for input'
    )
    parser.add_argument(
        '-c', '--chunk_rate', type=int, default=10,
        help='Number of audio stream chunks collected per second'
    )
    parser.add_argument(
        '-p', '--port', type=int, default=0,
        help='The port to run the server on, 0 for no server'
    )
    parser.add_argument(
        '-d', '--display_caption', type=int, default=0,
        help='Display caption on terminal, 0 for no display, 1 for display'
    )
    parser.add_argument(
        '-t', '--target_language', default='none',
        help='Target language code, "none" for no translation'
    )
    parser.add_argument(
        '-r', '--record', type=int, default=0,
        help='Whether to record the audio, 0 for no recording, 1 for recording'
    )
    parser.add_argument(
        '-rp', '--record_path', default='',
        help='Path to save the recorded audio'
    )
    parser.add_argument(
        '-s', '--source_language', default='auto',
        help='Source language code'
    )
    parser.add_argument(
        '-k', '--api_key', default='', help='API KEY for Gummy model'
    )
    parser.add_argument(
        '-tm', '--translation_model', default='ollama',
        help='Model for translation: ollama or google'
    )
    parser.add_argument(
        '-omn', '--ollama_name', default='', help='Ollama model name'
    )
    parser.add_argument(
        '-ourl', '--ollama_url', default='', help='Ollama API URL'
    )
    parser.add_argument(
        '-okey', '--ollama_api_key', default='', help='Ollama API Key'
    )
    parser.add_argument(
        '-vosk', '--vosk_model', default='', help='The path to the vosk model.'
    )
    parser.add_argument(
        '-sosv', '--sosv_model', default=None,
        help='The SenseVoice model path'
    )
    parser.add_argument(
        '-gurl', '--glm_url',
        default='https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
        help='GLM API URL'
    )
    parser.add_argument(
        '-gmodel', '--glm_model', default='glm-asr-2512',
        help='GLM Model Name'
    )
    parser.add_argument(
        '-gkey', '--glm_api_key', default='', help='GLM API Key'
    )
    parser.add_argument(
        '-fmodel', '--fun_asr_model', default='fun-asr-realtime',
        help='Fun-ASR realtime model name'
    )
    parser.add_argument(
        '-furl', '--fun_asr_url', default='',
        help='Fun-ASR workspace WebSocket URL'
    )
    parser.add_argument(
        '-fworkspace', '--fun_asr_workspace', default='',
        help='Fun-ASR Workspace ID'
    )
    parser.add_argument(
        '-fkey', '--fun_asr_api_key', default='',
        help='Fun-ASR API Key'
    )
    parser.add_argument(
        '-fsemantic', '--fun_asr_semantic_punctuation',
        type=int, choices=(0, 1), default=0,
        help='Enable Fun-ASR semantic punctuation'
    )
    parser.add_argument(
        '-fsilence', '--fun_asr_max_sentence_silence',
        type=int, default=1300,
        help='Fun-ASR VAD sentence silence in milliseconds'
    )
    parser.add_argument(
        '-fheartbeat', '--fun_asr_heartbeat',
        type=int, choices=(0, 1), default=1,
        help='Enable Fun-ASR heartbeat events'
    )
    parser.add_argument(
        '-fvocabulary', '--fun_asr_vocabulary_id', default='',
        help='Fun-ASR precompiled hotword vocabulary ID'
    )
    parser.add_argument(
        '-fvmodel', '--fun_asr_vocabulary_model',
        default='fun-asr-realtime',
        help='Target model used to create the Fun-ASR vocabulary'
    )
    parser.add_argument(
        '-fcontext', '--fun_asr_context_term',
        action='append', default=[],
        help='Fun-ASR context term; repeat for multiple terms'
    )
    parser.add_argument(
        '-ash', '--apple_speech_helper', default='',
        help='Path to the macOS Apple Speech helper executable'
    )
    return parser


def parse_args(arguments: list[str] | None = None) -> CliOptions:
    args = build_parser().parse_args(arguments)
    return CliOptions(
        caption_engine=args.caption_engine,
        audio_type=args.audio_type,
        chunk_rate=args.chunk_rate,
        port=args.port,
        display_caption=args.display_caption,
        target_language=args.target_language,
        record=bool(args.record),
        record_path=args.record_path,
        source_language=args.source_language,
        api_key=args.api_key,
        translation_model=args.translation_model,
        ollama_name=args.ollama_name,
        ollama_url=args.ollama_url,
        ollama_api_key=args.ollama_api_key,
        vosk_model=args.vosk_model,
        sosv_model=args.sosv_model,
        glm_url=args.glm_url,
        glm_model=args.glm_model,
        glm_api_key=args.glm_api_key,
        fun_asr_model=args.fun_asr_model,
        fun_asr_url=args.fun_asr_url,
        fun_asr_workspace=args.fun_asr_workspace,
        fun_asr_api_key=args.fun_asr_api_key,
        fun_asr_semantic_punctuation=bool(
            args.fun_asr_semantic_punctuation
        ),
        fun_asr_max_sentence_silence=args.fun_asr_max_sentence_silence,
        fun_asr_heartbeat=bool(args.fun_asr_heartbeat),
        fun_asr_vocabulary_id=args.fun_asr_vocabulary_id,
        fun_asr_vocabulary_model=args.fun_asr_vocabulary_model,
        fun_asr_context_terms=tuple(args.fun_asr_context_term),
        apple_speech_helper=args.apple_speech_helper,
    )
