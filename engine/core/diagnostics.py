from __future__ import annotations

import dataclasses
import enum
import math
import re
import traceback
from collections.abc import Mapping
from pathlib import Path
from typing import Any


_SENSITIVE_KEY = re.compile(
    r'(api.?key|token|password|secret|authorization|credential|cookie)',
    re.IGNORECASE,
)
_MAX_DEPTH = 8
_MAX_ITEMS = 256
_MAX_TEXT_LENGTH = 65_536


def redact_diagnostic_text(
    value: object,
    secrets: tuple[str, ...] = (),
) -> str:
    """Preserve diagnostic text while removing credentials."""

    text = value if isinstance(value, str) else str(value)
    for secret in sorted(
        (secret for secret in secrets if secret),
        key=len,
        reverse=True,
    ):
        text = text.replace(secret, '<redacted>')
    text = re.sub(
        r'\bsk-(?:sp-)?[A-Za-z0-9_-]{8,}\b',
        '<redacted>',
        text,
    )
    text = re.sub(
        r'\bBearer\s+[^\s"\']+',
        'Bearer <redacted>',
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r'([?&](?:api_?key|token|password|secret)=)[^&\s]+',
        r'\1<redacted>',
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r'\b(?:api.?key|token|password|secret|credential)'
        r'[-_:=\s]+[A-Za-z0-9._-]{4,}',
        '<redacted>',
        text,
        flags=re.IGNORECASE,
    )
    if len(text) <= _MAX_TEXT_LENGTH:
        return text
    return text[:_MAX_TEXT_LENGTH] + '<truncated>'


def safe_diagnostic_value(
    value: object,
    *,
    secrets: tuple[str, ...] = (),
) -> object:
    """Convert arbitrary exceptions and SDK objects to safe JSON data."""

    return _serialize(value, secrets, set(), 0, '')


def exception_diagnostic(
    error: BaseException,
    *,
    operation: str,
    secrets: tuple[str, ...] = (),
) -> dict[str, object]:
    diagnostic = _exception_value(error, secrets, set(), 0)
    return {
        'operation': operation,
        **diagnostic,
    }


def sdk_diagnostic(
    value: object,
    *,
    operation: str,
    secrets: tuple[str, ...] = (),
) -> dict[str, object]:
    return {
        'operation': operation,
        'sdkResult': safe_diagnostic_value(value, secrets=secrets),
    }


def _serialize(
    value: object,
    secrets: tuple[str, ...],
    seen: set[int],
    depth: int,
    key: str,
) -> object:
    if _SENSITIVE_KEY.search(key):
        return '' if value == '' else '<redacted>'
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, str):
        return redact_diagnostic_text(value, secrets)
    if isinstance(value, bytes):
        return {'type': 'bytes', 'length': len(value)}
    if isinstance(value, bytearray):
        return {'type': 'bytearray', 'length': len(value)}
    if isinstance(value, Path):
        return redact_diagnostic_text(str(value), secrets)
    if isinstance(value, enum.Enum):
        return _serialize(value.value, secrets, seen, depth, key)
    if isinstance(value, BaseException):
        return _exception_value(value, secrets, seen, depth)
    if depth >= _MAX_DEPTH:
        return {'truncated': 'maximum diagnostic depth reached'}

    object_id = id(value)
    if object_id in seen:
        return {'reference': type(value).__name__}
    seen.add(object_id)
    try:
        if dataclasses.is_dataclass(value) and not isinstance(value, type):
            return _serialize_mapping(
                {
                    field.name: getattr(value, field.name)
                    for field in dataclasses.fields(value)
                },
                secrets,
                seen,
                depth,
            )
        if isinstance(value, Mapping):
            return _serialize_mapping(value, secrets, seen, depth)
        if isinstance(value, (list, tuple, set, frozenset)):
            items = list(value)
            serialized = [
                _serialize(item, secrets, seen, depth + 1, '')
                for item in items[:_MAX_ITEMS]
            ]
            if len(items) > _MAX_ITEMS:
                serialized.append({
                    'truncatedItems': len(items) - _MAX_ITEMS,
                })
            return serialized

        attributes: dict[str, Any] = {}
        try:
            attributes.update(vars(value))
        except Exception as access_error:
            attributes['attributeAccessError'] = (
                f'{type(access_error).__name__}: {access_error}'
            )
        for attribute in (
            'status_code',
            'code',
            'message',
            'request_id',
            'reason',
            'url',
            'headers',
            'text',
        ):
            if attribute in attributes:
                continue
            try:
                attribute_value = getattr(value, attribute)
            except Exception as access_error:
                attributes[f'{attribute}AccessError'] = (
                    f'{type(access_error).__name__}: {access_error}'
                )
            else:
                if not callable(attribute_value):
                    attributes[attribute] = attribute_value
        result: dict[str, object] = {
            'objectType': type(value).__name__,
            'objectModule': type(value).__module__,
        }
        if attributes:
            result['attributes'] = _serialize_mapping(
                attributes,
                secrets,
                seen,
                depth,
            )
        else:
            try:
                representation = repr(value)
            except Exception as representation_error:
                representation = (
                    f'<repr failed: {type(representation_error).__name__}: '
                    f'{representation_error}>'
                )
            result['representation'] = redact_diagnostic_text(
                representation,
                secrets,
            )
        return result
    finally:
        seen.discard(object_id)


def _serialize_mapping(
    value: Mapping[object, object],
    secrets: tuple[str, ...],
    seen: set[int],
    depth: int,
) -> dict[str, object]:
    result: dict[str, object] = {}
    items = list(value.items())
    for raw_key, item in items[:_MAX_ITEMS]:
        key = redact_diagnostic_text(str(raw_key), secrets)
        result[key] = _serialize(
            item,
            secrets,
            seen,
            depth + 1,
            key,
        )
    if len(items) > _MAX_ITEMS:
        result['diagnosticTruncatedItems'] = len(items) - _MAX_ITEMS
    return result


def _exception_value(
    error: BaseException,
    secrets: tuple[str, ...],
    seen: set[int],
    depth: int,
) -> dict[str, object]:
    if id(error) in seen:
        return {'reference': type(error).__name__}
    if depth >= _MAX_DEPTH:
        return {'truncated': 'maximum exception depth reached'}
    seen.add(id(error))
    try:
        result: dict[str, object] = {
            'errorType': type(error).__name__,
            'errorModule': type(error).__module__,
            'errorMessage': redact_diagnostic_text(str(error), secrets),
            'errorArgs': _serialize(
                error.args,
                secrets,
                seen,
                depth + 1,
                'args',
            ),
            'stackTrace': redact_diagnostic_text(
                ''.join(traceback.format_exception(error)),
                secrets,
            ),
        }
        attributes = {
            key: value
            for key, value in vars(error).items()
            if key not in {'__cause__', '__context__'}
        }
        if attributes:
            result['errorAttributes'] = _serialize_mapping(
                attributes,
                secrets,
                seen,
                depth,
            )
        if error.__cause__ is not None:
            result['cause'] = _exception_value(
                error.__cause__,
                secrets,
                seen,
                depth + 1,
            )
        elif error.__context__ is not None and not error.__suppress_context__:
            result['context'] = _exception_value(
                error.__context__,
                secrets,
                seen,
                depth + 1,
            )
        return result
    finally:
        seen.discard(id(error))
