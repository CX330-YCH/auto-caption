import json
import os
import subprocess
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Callable

from core import (
    AudioFrame,
    CaptionFinal,
    CaptionPartial,
    CaptionRevoked,
    ProviderError,
    ProviderDebug,
    ProviderReady,
    ProviderStopped,
    RecognitionProvider,
    exception_diagnostic,
    safe_diagnostic_value,
)


class AppleSpeechProvider(RecognitionProvider):
    """Bridge mono PCM frames to the macOS SpeechAnalyzer helper."""

    def __init__(
        self,
        helper_path: str,
        locale: str,
        sample_rate: int,
        process_factory: Callable[..., subprocess.Popen] = subprocess.Popen,
        ready_timeout: float = 25.0,
        wall_clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        super().__init__()
        self._helper_path = helper_path
        self._locale = locale
        self._sample_rate = sample_rate
        self._process_factory = process_factory
        self._ready_timeout = ready_timeout
        self._wall_clock = wall_clock
        self._process: subprocess.Popen | None = None
        self._reader_thread: threading.Thread | None = None
        self._stderr_thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._ready_success = False
        self._start_error = ''
        self._stopping = False
        self._session_started_at = wall_clock()
        self._write_lock = threading.Lock()
        self._written_frames = 0
        self._written_bytes = 0
        self._write_duration_ms = 0.0
        self._output_events = 0
        self._stderr_lines = 0
        self._last_output_monotonic: float | None = None

    @property
    def name(self) -> str:
        return 'apple_speech'

    def start(self) -> None:
        if not self._helper_path or not os.path.isfile(self._helper_path):
            raise FileNotFoundError('Apple Speech helper executable was not found')
        self._session_started_at = self._wall_clock()
        self._process = self._process_factory(
            [
                self._helper_path,
                'transcribe',
                '--locale', self._locale,
                '--sample-rate', str(self._sample_rate),
                '--channels', '1',
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        self._reader_thread = threading.Thread(
            target=self._read_output,
            name='apple-speech-output',
            daemon=True,
        )
        self._reader_thread.start()
        self._stderr_thread = threading.Thread(
            target=self._read_stderr,
            name='apple-speech-stderr',
            daemon=True,
        )
        self._stderr_thread.start()
        if not self._ready.wait(self._ready_timeout):
            self._terminate()
            raise TimeoutError('Apple Speech helper did not become ready')
        if not self._ready_success:
            self._terminate()
            raise RuntimeError(
                self._start_error or 'Apple Speech helper failed before ready'
            )

    def accept_audio(self, frame: AudioFrame) -> None:
        if frame.format != 'pcm_s16le' or frame.channels != 1:
            raise ValueError('Apple Speech requires mono pcm_s16le audio')
        process = self._process
        if process is None or process.stdin is None or process.poll() is not None:
            raise RuntimeError('Apple Speech helper is not running')
        with self._write_lock:
            write_started_at = time.monotonic()
            process.stdin.write(frame.data)
            process.stdin.flush()
            self._write_duration_ms += (
                time.monotonic() - write_started_at
            ) * 1000
            self._written_frames += 1
            self._written_bytes += len(frame.data)

    def stop(self) -> None:
        self._stopping = True
        process = self._process
        if process is not None:
            if process.stdin is not None and not process.stdin.closed:
                process.stdin.close()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._terminate()
        if self._reader_thread is not None:
            self._reader_thread.join(timeout=2)
        if self._stderr_thread is not None:
            self._stderr_thread.join(timeout=2)
        self._emit(ProviderStopped(self.name, 'Apple Speech stopped.'))

    def _read_output(self) -> None:
        process = self._process
        if process is None or process.stdout is None:
            return
        try:
            for raw_line in process.stdout:
                if not raw_line.strip():
                    continue
                envelope = json.loads(raw_line.decode('utf-8'))
                self._handle_envelope(envelope)
        except Exception as error:
            self._start_error = (
                f'Apple Speech helper output failed ({type(error).__name__})'
            )
            self._ready.set()
            self._emit(ProviderError(
                provider=self.name,
                message=f'Apple Speech helper output failed ({type(error).__name__})',
                fatal=not self._stopping,
                details=exception_diagnostic(
                    error,
                    operation='apple_speech.read_output',
                ),
            ))
        finally:
            self._ready.set()

    def _handle_envelope(self, envelope: dict[str, Any]) -> None:
        self._output_events += 1
        self._last_output_monotonic = time.monotonic()
        if envelope.get('protocolVersion') != 1:
            raise ValueError('Unsupported Apple Speech helper protocol')
        event_type = envelope.get('type')
        payload = envelope.get('payload')
        if not isinstance(payload, dict):
            raise ValueError('Invalid Apple Speech helper payload')
        if event_type == 'ready':
            self._ready_success = True
            self._emit(ProviderReady(self.name, 'Apple Speech ready.'))
            self._ready.set()
            return
        if event_type == 'error':
            self._start_error = (
                f"Apple Speech helper failed ({payload.get('code', 'unknown')})"
            )
            self._ready.set()
            self._emit(ProviderError(
                provider=self.name,
                message=f"Apple Speech helper failed ({payload.get('code', 'unknown')})",
                fatal=True,
                details={
                    'operation': 'apple_speech.helper.error',
                    'payload': safe_diagnostic_value(payload),
                },
            ))
            return
        if event_type != 'transcript':
            return
        caption_id = payload.get('id')
        phase = payload.get('phase')
        if not isinstance(caption_id, int):
            raise ValueError('Invalid Apple Speech caption ID')
        if phase == 'revoke':
            self._emit(CaptionRevoked(caption_id))
            return
        if phase not in ('partial', 'final'):
            raise ValueError('Invalid Apple Speech transcript phase')
        text = payload.get('text')
        start_seconds = payload.get('startSeconds')
        end_seconds = payload.get('endSeconds')
        if not isinstance(text, str) or not isinstance(start_seconds, (int, float)) or not isinstance(end_seconds, (int, float)):
            raise ValueError('Invalid Apple Speech transcript event')
        event_class = CaptionFinal if phase == 'final' else CaptionPartial
        self._emit(event_class(
            caption_id=caption_id,
            started_at=self._timestamp(float(start_seconds)),
            ended_at=self._timestamp(float(end_seconds)),
            text=text,
        ))

    def _read_stderr(self) -> None:
        process = self._process
        if process is None or process.stderr is None:
            return
        try:
            for raw_line in process.stderr:
                self._stderr_lines += 1
                if not self._debug_enabled():
                    continue
                self._emit(ProviderDebug(
                    provider=self.name,
                    message='Apple Speech helper stderr.',
                    details={
                        'line': raw_line.decode(
                            'utf-8',
                            errors='replace',
                        ).rstrip('\r\n'),
                    },
                ))
        except Exception as error:
            self._emit(ProviderError(
                provider=self.name,
                message=(
                    'Apple Speech stderr reader failed '
                    f'({type(error).__name__})'
                ),
                fatal=False,
                details=exception_diagnostic(
                    error,
                    operation='apple_speech.read_stderr',
                ),
            ))

    def diagnostic_snapshot(self) -> dict[str, object]:
        last_output_age_ms = None
        if self._last_output_monotonic is not None:
            last_output_age_ms = (
                time.monotonic() - self._last_output_monotonic
            ) * 1000
        return {
            **super().diagnostic_snapshot(),
            'helperPid': self._process.pid if self._process else None,
            'helperRunning': (
                self._process is not None and self._process.poll() is None
            ),
            'writtenFrames': self._written_frames,
            'writtenBytes': self._written_bytes,
            'writtenAudioMs': self._written_bytes / self._sample_rate / 2 * 1000,
            'writeDurationMs': self._write_duration_ms,
            'outputEvents': self._output_events,
            'stderrLines': self._stderr_lines,
            'lastOutputAgeMs': last_output_age_ms,
            'outputThreadAlive': bool(
                self._reader_thread and self._reader_thread.is_alive()
            ),
            'stderrThreadAlive': bool(
                self._stderr_thread and self._stderr_thread.is_alive()
            ),
        }

    def _timestamp(self, offset_seconds: float) -> str:
        value = self._session_started_at + timedelta(seconds=max(0, offset_seconds))
        return value.strftime('%H:%M:%S.%f')[:-3]

    def _terminate(self) -> None:
        process = self._process
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
