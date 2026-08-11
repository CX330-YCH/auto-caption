import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol


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
