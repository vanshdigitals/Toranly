"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings
from app.core.errors import ProblemError
from app.core.ratelimit import SlidingWindowLimiter
from app.core.security import client_ip, hash_ip


def settings_of(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


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
