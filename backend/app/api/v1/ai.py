"""AI endpoints. The browser talks only to these; xAI is called from the server only."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Any, Literal

from anyio import to_thread
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from app.ai.contracts import ContractName
from app.ai.contracts.models import PlanContext
from app.ai.orchestrator import AiService
from app.api.deps import api_rate_limit, ip_hash_of, settings_of
from app.core.errors import ProblemError
from app.core.security import (
    DEVICE_COOKIE,
    device_hash,
    new_device_id,
    set_device_cookie,
    sign_device_id,
    verify_device_cookie,
)

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("toranly.ai.api")


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiStatusResponse(Camel):
    available: bool
    reason: str | None = None
    message: str | None = None
    remaining_today: int
    limit_today: int = Field(description="AI suggestions each device gets per day")
    resets_at: datetime


class SuggestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract: ContractName
    context: PlanContext
    feedback: Annotated[str, StringConstraints(max_length=500)] | None = None


class UsageOut(Camel):
    input_tokens: int
    output_tokens: int


class SuggestResponse(Camel):
    status: Literal["ready", "fallback", "failed"]
    items: list[dict[str, Any]] = Field(description="Validated items in AI_SCHEMAS.md §4 format")
    assumptions: list[str]
    warnings: list[str]
    message: str | None
    usage: UsageOut


def ai_service(request: Request) -> AiService:
    service: AiService = request.app.state.ai_service
    return service


def _secret(request: Request) -> str:
    return settings_of(request).session_secret.get_secret_value()


@router.get(
    "/status",
    response_model=AiStatusResponse,
    response_model_by_alias=True,
    dependencies=[Depends(api_rate_limit)],
)
async def ai_status(
    request: Request, response: Response, service: Annotated[AiService, Depends(ai_service)]
) -> AiStatusResponse:
    settings = settings_of(request)
    raw = request.cookies.get(DEVICE_COOKIE)
    device_id = verify_device_cookie(raw, _secret(request))
    if device_id is None:
        if raw is not None:
            logger.warning("device_cookie_rejected")
        device_id = new_device_id()
        set_device_cookie(response, sign_device_id(device_id, _secret(request)), settings)
    try:
        availability = await to_thread.run_sync(
            service.availability, device_hash(device_id), ip_hash_of(request)
        )
    except ProblemError:
        raise
    except Exception as exc:
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
    body: SuggestRequest, request: Request, service: Annotated[AiService, Depends(ai_service)]
) -> SuggestResponse:
    raw = request.cookies.get(DEVICE_COOKIE)
    device_id = verify_device_cookie(raw, _secret(request))
    if device_id is None:
        if raw is not None:
            logger.warning("device_cookie_rejected")
        raise ProblemError(
            401,
            "device_required",
            "Reload the page and try again.",
        )
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
