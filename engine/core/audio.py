import time
import wave
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from queue import Full, Queue
from typing import Protocol

from .diagnostics import exception_diagnostic


@dataclass(frozen=True)
class AudioFrame:
    data: bytes
    sample_rate: int
    channels: int
    sample_width: int
    captured_at: float
    format: str = 'pcm_s16le'

    def __post_init__(self) -> None:
        if not isinstance(self.data, bytes):
            raise TypeError('AudioFrame.data must be bytes')
        if self.sample_rate <= 0:
            raise ValueError('AudioFrame.sample_rate must be positive')
        if self.channels <= 0:
            raise ValueError('AudioFrame.channels must be positive')
        if self.sample_width <= 0:
            raise ValueError('AudioFrame.sample_width must be positive')


class AudioSource(Protocol):
    RATE: int
    CHANNELS: int
    SAMP_WIDTH: int

    def open_stream(self): ...
    def read_chunk(self) -> bytes | None: ...
    def close_stream_signal(self) -> None: ...
    def close_stream(self) -> None: ...


class AudioPipeline:
    """Convert one source chunk into a self-describing provider frame."""

    def __init__(
        self,
        converter: Callable[[bytes], bytes],
        output_sample_rate: int,
        output_channels: int = 1,
        output_sample_width: int = 2,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if output_sample_rate <= 0:
            raise ValueError('output_sample_rate must be positive')
        if output_channels <= 0:
            raise ValueError('output_channels must be positive')
        if output_sample_width <= 0:
            raise ValueError('output_sample_width must be positive')
        self._converter = converter
        self._output_sample_rate = output_sample_rate
        self._output_channels = output_channels
        self._output_sample_width = output_sample_width
        self._clock = clock

    def process(self, raw_chunk: bytes) -> AudioFrame:
        return AudioFrame(
            data=self._converter(raw_chunk),
            sample_rate=self._output_sample_rate,
            channels=self._output_channels,
            sample_width=self._output_sample_width,
            captured_at=self._clock(),
        )


class AudioCaptureWorker:
    """Read, optionally record, transform and enqueue platform audio."""

    def __init__(
        self,
        source: AudioSource,
        pipeline: AudioPipeline,
        output_queue: Queue[AudioFrame],
        is_running: Callable[[], bool],
        request_stop: Callable[[], None],
        info_handler: Callable[[str], None],
        error_handler: Callable[[str], None],
        diagnostic_handler: Callable[
            [str, dict[str, object]], None
        ] | None = None,
        metric_handler: Callable[
            [str, str, dict[str, object]], None
        ] | None = None,
        record: bool = False,
        recording_path: str = '',
    ) -> None:
        self._source = source
        self._pipeline = pipeline
        self._output_queue = output_queue
        self._is_running = is_running
        self._request_stop = request_stop
        self._info_handler = info_handler
        self._error_handler = error_handler
        self._diagnostic_handler = diagnostic_handler or (
            lambda message, details: None
        )
        self._metric_handler = metric_handler or (
            lambda category, name, fields: None
        )
        self._record = record
        self._recording_path = recording_path

    def run(self) -> None:
        recording = None
        recording_name = ''
        frame_sequence = 0
        try:
            self._source.open_stream()
            if self._record:
                recording_name, recording = self._open_recording()
                self._info_handler('Audio recording...')
            while self._is_running():
                read_started_at = time.monotonic()
                raw_chunk = self._source.read_chunk()
                captured_at = time.monotonic()
                if raw_chunk is None:
                    continue
                if recording is not None:
                    recording.writeframes(raw_chunk)
                frame = self._pipeline.process(raw_chunk)
                processed_at = time.monotonic()
                enqueue_started_at = processed_at
                full_waits = 0
                while self._is_running():
                    try:
                        self._output_queue.put(frame, timeout=0.1)
                        frame_sequence += 1
                        enqueued_at = time.monotonic()
                        audio_duration_ms = (
                            len(frame.data) * 1000 /
                            frame.sample_rate /
                            frame.channels /
                            frame.sample_width
                        )
                        self._metric_handler(
                            'audio.capture',
                            'frame.enqueued',
                            {
                                'frameSequence': frame_sequence,
                                'rawBytes': len(raw_chunk),
                                'processedBytes': len(frame.data),
                                'sampleRate': frame.sample_rate,
                                'channels': frame.channels,
                                'sampleWidth': frame.sample_width,
                                'audioDurationMs': audio_duration_ms,
                                'readMs': (
                                    captured_at - read_started_at
                                ) * 1000,
                                'processMs': (
                                    processed_at - captured_at
                                ) * 1000,
                                'enqueueWaitMs': (
                                    enqueued_at - enqueue_started_at
                                ) * 1000,
                                'queueDepth': self._output_queue.qsize(),
                                'queueCapacity': self._output_queue.maxsize,
                                'queueFullWaits': full_waits,
                            },
                        )
                        break
                    except Full:
                        full_waits += 1
                        continue
        except Exception as error:
            self._error_handler(
                f'Audio capture failed ({type(error).__name__})'
            )
            self._diagnostic_handler(
                'Audio capture failed.',
                exception_diagnostic(
                    error,
                    operation='audio.capture',
                ),
            )
            self._request_stop()
        finally:
            if recording is not None:
                try:
                    recording.close()
                    self._info_handler(f'Audio saved to {recording_name}')
                except Exception as error:
                    self._report_cleanup_error(
                        'Audio recording failed to close.',
                        'audio.recording.close',
                        error,
                    )
            try:
                self._source.close_stream_signal()
            except Exception as error:
                self._report_cleanup_error(
                    'Audio capture stream failed to signal close.',
                    'audio.close_stream_signal',
                    error,
                )

    def _open_recording(self):
        path = self._recording_path.strip('"')
        if path and not path.endswith('/'):
            path += '/'
        timestamp = datetime.now().strftime('audio-%Y-%m-%dT%H-%M-%S')
        full_name = f'{path}{timestamp}.wav'
        recording = wave.open(full_name, 'wb')
        recording.setnchannels(self._source.CHANNELS)
        recording.setsampwidth(self._source.SAMP_WIDTH)
        recording.setframerate(self._source.RATE)
        return full_name, recording

    def _report_cleanup_error(
        self,
        message: str,
        operation: str,
        error: Exception,
    ) -> None:
        self._error_handler(f'{message} ({type(error).__name__})')
        self._diagnostic_handler(
            message,
            exception_diagnostic(error, operation=operation),
        )
