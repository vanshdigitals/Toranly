"""JSON logs with redaction.

Rules: never log request bodies, prompts, cookies, IPs or keys. Only an allowlist of `extra`
fields is emitted, and every rendered line passes through secret redaction as a backstop.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import traceback
from collections.abc import Iterable
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

_ALLOWED_EXTRA = frozenset(
    {
        "path",
        "method",
        "status",
        "latency_ms",
        "error_type",
        "error_code",
        "contract",
        "outcome",
        "attempts",
        "input_tokens",
        "output_tokens",
        "est_cost_usd",
        "retry_after",
        "alert",
        "layer",
        "deleted_rows",
        "provider_status",
        "model",
        "provider",
        "category",
        "failover",
        "attempt",
    }
)

_PATTERNS = [
    re.compile(r"xai-[A-Za-z0-9_\-]{10,}"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+"),
    re.compile(r"(?i)(api[_-]?key|authorization|cookie|set-cookie)(\"?\s*[:=]\s*)\S+"),
    re.compile(r"postgres(?:ql)?(?:\+psycopg)?://[^\s\"']+"),
]


class Redactor:
    def __init__(self) -> None:
        self._secrets: set[str] = set()

    def register(self, values: Iterable[str]) -> None:
        for value in values:
            if value and len(value) >= 6:
                self._secrets.add(value)

    def redact(self, text: str) -> str:
        for secret in self._secrets:
            if secret in text:
                text = text.replace(secret, "[REDACTED]")
        for pattern in _PATTERNS:
            text = pattern.sub(_mask, text)
        return text


def _mask(match: re.Match[str]) -> str:
    if match.lastindex and match.lastindex >= 2:
        return f"{match.group(1)}{match.group(2)}[REDACTED]"
    return "[REDACTED]"


redactor = Redactor()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id
        for key in _ALLOWED_EXTRA:
            if key in record.__dict__:
                payload[key] = record.__dict__[key]
        if record.exc_info and record.exc_info[1] is not None:
            exc = record.exc_info[1]
            payload["exc_type"] = type(exc).__name__
            # Frame locations only: no exception message and no source text, either of which
            # could contain request data or secrets.
            frames = traceback.extract_tb(exc.__traceback__)[-15:]
            payload["stack"] = [f"{f.filename}:{f.lineno} in {f.name}" for f in frames]
        return redactor.redact(json.dumps(payload, default=str))


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # Uvicorn's access log includes client addresses and query strings; the app logs requests.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    # The HTTP client libraries can log request lines; keep them quiet.
    for name in ("httpx", "httpcore", "openai"):
        logging.getLogger(name).setLevel(logging.WARNING)
