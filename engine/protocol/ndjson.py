import json
from dataclasses import dataclass, field
from typing import Any


DEFAULT_MAX_LINE_LENGTH = 1024 * 1024


@dataclass(frozen=True)
class ProtocolDecodeError:
    kind: str
    line_number: int
    message: str


@dataclass
class DecodeBatch:
    messages: list[Any] = field(default_factory=list)
    errors: list[ProtocolDecodeError] = field(default_factory=list)


class NDJSONDecoder:
    """Incrementally decode newline-delimited UTF-8 JSON socket frames."""

    def __init__(self, max_line_length: int = DEFAULT_MAX_LINE_LENGTH):
        if not isinstance(max_line_length, int) or max_line_length <= 0:
            raise ValueError('max_line_length must be a positive integer')
        self.max_line_length = max_line_length
        self._pending = b''
        self._discarding_oversized_line = False
        self._line_number = 0

    def push(self, chunk: bytes) -> DecodeBatch:
        if not isinstance(chunk, bytes):
            raise TypeError('chunk must be bytes')
        return self._consume(chunk, final=False)

    def finish(self) -> DecodeBatch:
        return self._consume(b'', final=True)

    def reset(self) -> None:
        self._pending = b''
        self._discarding_oversized_line = False
        self._line_number = 0

    def _consume(self, chunk: bytes, final: bool) -> DecodeBatch:
        batch = DecodeBatch()
        remaining = chunk

        if self._discarding_oversized_line:
            newline_index = remaining.find(b'\n')
            if newline_index == -1:
                if final:
                    self._discarding_oversized_line = False
                return batch
            remaining = remaining[newline_index + 1:]
            self._discarding_oversized_line = False

        self._pending += remaining
        while b'\n' in self._pending:
            line, self._pending = self._pending.split(b'\n', 1)
            self._decode_line(line, batch)

        if len(self._pending) > self.max_line_length:
            self._line_number += 1
            batch.errors.append(self._line_too_long_error())
            self._pending = b''
            self._discarding_oversized_line = True

        if final and not self._discarding_oversized_line and self._pending:
            self._decode_line(self._pending, batch)
            self._pending = b''

        if final:
            self._discarding_oversized_line = False
        return batch

    def _decode_line(self, line_with_optional_carriage_return: bytes, batch: DecodeBatch) -> None:
        self._line_number += 1
        line = line_with_optional_carriage_return.removesuffix(b'\r')
        if not line.strip():
            return
        if len(line) > self.max_line_length:
            batch.errors.append(self._line_too_long_error())
            return

        try:
            text = line.decode('utf-8')
            batch.messages.append(json.loads(text))
        except UnicodeDecodeError as error:
            batch.errors.append(ProtocolDecodeError(
                kind='invalid-utf8',
                line_number=self._line_number,
                message=f'Invalid UTF-8 at byte {error.start}'
            ))
        except json.JSONDecodeError as error:
            batch.errors.append(ProtocolDecodeError(
                kind='invalid-json',
                line_number=self._line_number,
                message=f'{error.msg} at character {error.pos}'
            ))

    def _line_too_long_error(self) -> ProtocolDecodeError:
        return ProtocolDecodeError(
            kind='line-too-long',
            line_number=self._line_number,
            message=f'Protocol line exceeded {self.max_line_length} bytes'
        )
