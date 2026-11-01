"""Device cookie signing, IP hashing, Origin check, body limit and security headers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import logging
import secrets
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import Settings
from app.core.errors import PROBLEM_CONTENT_TYPE, problem_bytes
from app.core.logging import request_id_var

logger = logging.getLogger("toranly.security")

DEVICE_COOKIE = "tdv"
DEVICE_COOKIE_PATH = "/api"
DEVICE_COOKIE_MAX_AGE = 180 * 24 * 3600
DEVICE_ID_BYTES = 32

PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
# Swagger UI in development loads its assets from a CDN; production has no docs at all.
DOCS_CSP = (
    "default-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; frame-ancestors 'none'"
)
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
STATE_CHANGING = frozenset({"POST", "PUT", "PATCH", "DELETE"})


# --- Device identity -------------------------------------------------------------------------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def new_device_id() -> bytes:
    return secrets.token_bytes(DEVICE_ID_BYTES)


def sign_device_id(device_id: bytes, secret: str) -> str:
    mac = hmac.new(secret.encode(), b"tdv.v1." + device_id, hashlib.sha256).digest()
    return f"{_b64(device_id)}.{_b64(mac)}"


def verify_device_cookie(value: str | None, secret: str) -> bytes | None:
    """Return the device id when the cookie is well formed and the HMAC matches."""
    if not value or len(value) > 200 or value.count(".") != 1:
        return None
    raw_id, raw_mac = value.split(".")
    try:
        device_id = _unb64(raw_id)
        mac = _unb64(raw_mac)
    except ValueError:
        return None
    if len(device_id) != DEVICE_ID_BYTES:
        return None
    expected = hmac.new(secret.encode(), b"tdv.v1." + device_id, hashlib.sha256).digest()
    if not hmac.compare_digest(mac, expected):
        return None
    return device_id


def device_hash(device_id: bytes) -> str:
    """Only this hash is stored in the database."""
    return hashlib.sha256(device_id).hexdigest()


# --- IP handling -----------------------------------------------------------------------------


def hash_ip(ip: str, salt: str) -> str:
    return hmac.new(salt.encode(), ip.encode(), hashlib.sha256).hexdigest()


def _parse_networks(cidrs: list[str]) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    return [ipaddress.ip_network(c, strict=False) for c in cidrs]


def _in_networks(ip: str, networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network]) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in networks)


def client_ip(request: Request, settings: Settings) -> str:
    """Client address. X-Forwarded-For is used only when the direct peer is a trusted proxy.

    Walks the header from the right and returns the first address that is not itself a trusted
    proxy, so a client cannot spoof its address by sending its own X-Forwarded-For.
    """
    peer = request.client.host if request.client else "unknown"
    networks = _parse_networks(settings.trusted_proxy_cidrs)
    if not networks or not _in_networks(peer, networks):
        return peer
    header = request.headers.get("x-forwarded-for", "")
    hops = [h.strip() for h in header.split(",") if h.strip()]
    for hop in reversed(hops):
        if not _in_networks(hop, networks):
            try:
                return str(ipaddress.ip_address(hop))
            except ValueError:
                return peer
    return peer


# --- Origin check ----------------------------------------------------------------------------


def allowed_origins(settings: Settings, scope: Scope) -> set[str]:
    origins: set[str] = set()
    if settings.app_origin:
        origins.add(settings.app_origin)
    else:
        headers = dict(scope.get("headers") or [])
        host = headers.get(b"host", b"").decode("latin-1")
        if host:
            scheme = "https" if settings.is_production else scope.get("scheme", "http")
            origins.add(f"{scheme}://{host}")
    if not settings.is_production:
        origins.update(settings.cors_origins)
    return origins


# --- ASGI middleware -------------------------------------------------------------------------


async def _send_problem(
    send: Send,
    status: int,
    code: str,
    detail: str,
    extra_headers: list[tuple[bytes, bytes]],
    instance: str | None = None,
) -> None:
    body = problem_bytes(status, code, detail, instance)
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", PROBLEM_CONTENT_TYPE.encode()),
                (b"content-length", str(len(body)).encode()),
                *extra_headers,
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class SecurityMiddleware:
    """Outermost app middleware.

    Assigns X-Request-Id, adds security headers to every response, rejects oversized bodies
    (413) and state-changing requests without an allowed Origin (403), turns unhandled
    exceptions into a 500 Problem Details response without internals, and writes one redacted
    access log line per request.
    """

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        self.app = app
        self.settings = settings

    def _headers(self, path: str, request_id: str) -> list[tuple[bytes, bytes]]:
        csp = DOCS_CSP if (not self.settings.is_production and path in DOCS_PATHS) else CSP
        headers = [
            (b"x-request-id", request_id.encode()),
            (b"content-security-policy", csp.encode()),
            (b"x-content-type-options", b"nosniff"),
            (b"referrer-policy", b"same-origin"),
            (b"x-frame-options", b"DENY"),
            # The planner needs no device features; deny them outright.
            (b"permissions-policy", PERMISSIONS_POLICY.encode()),
            (b"cross-origin-opener-policy", b"same-origin"),
        ]
        if self.settings.is_production:
            headers.append((b"strict-transport-security", b"max-age=63072000; includeSubDomains"))
        if path.startswith("/api/"):
            headers.append((b"cache-control", b"no-store"))
        return headers

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        token = request_id_var.set(request_id)
        path: str = scope.get("path", "")
        method: str = scope.get("method", "GET")
        extra_headers = self._headers(path, request_id)
        started = time.perf_counter()
        status_holder: dict[str, int] = {"status": 0}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                existing = {k.lower() for k, _ in message.get("headers", [])}
                message = dict(message)
                message["headers"] = [
                    *message.get("headers", []),
                    *[(k, v) for k, v in extra_headers if k not in existing],
                ]
            await send(message)

        async def reject(status: int, code: str, detail: str) -> None:
            status_holder["status"] = status
            await _send_problem(send, status, code, detail, extra_headers, path)

        try:
            if method in STATE_CHANGING:
                origin = dict(scope.get("headers") or []).get(b"origin", b"").decode("latin-1")
                if not origin or origin.rstrip("/") not in allowed_origins(self.settings, scope):
                    await reject(
                        403,
                        "origin_not_allowed",
                        "This request did not come from the Toranly app.",
                    )
                    return
                replay = await self._read_limited_body(scope, receive)
                if replay is None:
                    await reject(
                        413,
                        "payload_too_large",
                        f"The request is larger than {self.settings.max_body_bytes} bytes.",
                    )
                    return
                receive = replay
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            logger.error(
                "unhandled_exception",
                exc_info=exc,
                extra={"path": path, "error_type": type(exc).__name__},
            )
            if status_holder["status"] == 0:
                await reject(
                    500,
                    "internal_error",
                    "Something went wrong on our side. Try again in a moment.",
                )
        finally:
            logger.info(
                "request",
                extra={
                    "method": method,
                    "path": path,
                    "status": status_holder["status"],
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id_var.reset(token)

    async def _read_limited_body(
        self, scope: Scope, receive: Receive
    ) -> Callable[[], Awaitable[Message]] | None:
        limit = self.settings.max_body_bytes
        headers = dict(scope.get("headers") or [])
        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > limit:
                    return None
            except ValueError:
                return None
        chunks: list[bytes] = []
        size = 0
        more = True
        while more:
            message = await receive()
            if message["type"] == "http.disconnect":
                break
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > limit:
                return None
            chunks.append(chunk)
            more = message.get("more_body", False)
        body = b"".join(chunks)
        sent = False

        async def replay() -> Message:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        return replay


def set_device_cookie(response: Any, value: str, settings: Settings) -> None:
    response.set_cookie(
        DEVICE_COOKIE,
        value,
        max_age=DEVICE_COOKIE_MAX_AGE,
        path=DEVICE_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )
