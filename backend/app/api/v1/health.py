"""Liveness and readiness."""

from __future__ import annotations

import logging

from anyio import fail_after, to_thread
from fastapi import APIRouter, Request

from app.core.errors import ProblemError
from app.db.session import ping

READY_TIMEOUT_SECONDS = 12
router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger("toranly.health")


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(request: Request) -> dict[str, object]:
    try:
        with fail_after(READY_TIMEOUT_SECONDS):
            await to_thread.run_sync(ping, request.app.state.engine, abandon_on_cancel=True)
    except Exception as exc:
        logger.warning("readiness_db_failed", extra={"error_type": type(exc).__name__})
        raise ProblemError(
            503, "database_unavailable", "The database is not reachable yet. Try again shortly."
        ) from None
    # Sanitised provider health (ok, cooldown, circuit_open, disabled, not_configured). It is
    # derived from recent requests only: no paid call is made to check a provider.
    states = request.app.state.ai_service.provider_states()
    return {"status": "ready", "database": "ok", "ai": states}
