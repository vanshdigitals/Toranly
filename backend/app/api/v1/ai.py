"""AI endpoints: HTTP only. Orchestration lives in app/ai/orchestrator.py.

The browser talks only to these; providers (xAI, Groq) are called from the server.
"""

from __future__ import annotations

import logging
from typing import Annotated

from anyio import to_thread
from fastapi import APIRouter, Depends, Request

from app.ai.orchestrator import AiService
from app.api.deps import ai_service, api_rate_limit, ensure_device, ip_hash_of, require_device
from app.api.v1.ai_models import AiStatusResponse, SuggestRequest, SuggestResponse, UsageOut
from app.core.errors import ProblemError
from app.core.security import device_hash

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("toranly.ai.api")


@router.get(
    "/status",
    response_model=AiStatusResponse,
    response_model_by_alias=True,
    dependencies=[Depends(api_rate_limit)],
)
async def ai_status(
    request: Request,
    device_id: Annotated[bytes, Depends(ensure_device)],
    service: Annotated[AiService, Depends(ai_service)],
) -> AiStatusResponse:
    """Whether AI is available for this device, how many suggestions are left, and when."""
    try:
        availability = await to_thread.run_sync(
            service.availability, device_hash(device_id), ip_hash_of(request)
        )
    except ProblemError:
        raise
    except Exception as exc:  # database down: say so without internals
        logger.error("ai_status_failed", extra={"error_type": type(exc).__name__})
        raise ProblemError(
            503, "ai_unavailable", "AI suggestions aren't available right now."
        ) from None
    return AiStatusResponse(
        available=availability.available,
        reason=availability.reason,
        message=availability.message,
        remaining_today=availability.remaining_today,
        limit_today=service.limits.per_device_day,
        resets_at=availability.resets_at,
    )


@router.post("/suggest", response_model=SuggestResponse, response_model_by_alias=True)
async def ai_suggest(
    body: SuggestRequest,
    request: Request,
    device_id: Annotated[bytes, Depends(require_device)],
    service: Annotated[AiService, Depends(ai_service)],
) -> SuggestResponse:
    """Validated suggestions for one contract; nothing is stored or applied."""
    outcome = await service.suggest(
        body.contract, body.context, body.feedback, device_hash(device_id), ip_hash_of(request)
    )
    return SuggestResponse(
        status=outcome.status,
        items=outcome.items,
        assumptions=outcome.assumptions,
        warnings=outcome.warnings,
        message=outcome.message,
        usage=UsageOut(
            input_tokens=outcome.usage.input_tokens, output_tokens=outcome.usage.output_tokens
        ),
    )
