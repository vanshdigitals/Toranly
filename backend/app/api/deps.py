"""Shared FastAPI dependencies: settings, client identity, the device cookie and API limits."""

from __future__ import annotations

import logging

from fastapi import Request, Response

from app.ai.orchestrator import AiService
from app.core.config import Settings
from app.core.errors import ProblemError
from app.core.ratelimit import SlidingWindowLimiter
from app.core.security import (
    DEVICE_COOKIE,
    client_ip,
    hash_ip,
    new_device_id,
    set_device_cookie,
    sign_device_id,
    verify_device_cookie,
)

logger = logging.getLogger("toranly.api")


def settings_of(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def ai_service(request: Request) -> AiService:
    """The process-wide AI orchestrator created at startup."""
    service: AiService = request.app.state.ai_service
    return service


def ip_hash_of(request: Request) -> str:
    settings = settings_of(request)
    return hash_ip(client_ip(request, settings), settings.ip_hash_salt.get_secret_value())


def api_rate_limit(request: Request) -> None:
    """General per-IP limit (API_LIMIT_PER_IP_PER_MINUTE), in memory, per process."""
    limiter: SlidingWindowLimiter = request.app.state.api_limiter
    wait = limiter.hit(ip_hash_of(request))
    if wait is not None:
        raise ProblemError(
            429,
            "rate_limited",
            "Too many requests from your network. Wait a minute and try again.",
            retry_after=wait,
        )


def _device_from_cookie(request: Request) -> bytes | None:
    """The verified device id from the signed cookie, or None (a tampered cookie is logged)."""
    raw = request.cookies.get(DEVICE_COOKIE)
    secret = settings_of(request).session_secret.get_secret_value()
    device_id = verify_device_cookie(raw, secret)
    if device_id is None and raw is not None:
        logger.warning("device_cookie_rejected")
    return device_id


def ensure_device(request: Request, response: Response) -> bytes:
    """The caller's device id; issues a new signed cookie when there is no valid one."""
    device_id = _device_from_cookie(request)
    if device_id is None:
        settings = settings_of(request)
        device_id = new_device_id()
        signed = sign_device_id(device_id, settings.session_secret.get_secret_value())
        set_device_cookie(response, signed, settings)
    return device_id


def require_device(request: Request) -> bytes:
    """The caller's device id; AI suggestions need a cookie issued by GET /ai/status first."""
    device_id = _device_from_cookie(request)
    if device_id is None:
        raise ProblemError(401, "device_required", "Reload the page and try again.")
    return device_id
