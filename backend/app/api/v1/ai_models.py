"""Request and response models for the AI endpoints (camelCase on the wire)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from app.ai.contracts import ContractName
from app.ai.contracts.models import PlanContext

FEEDBACK_MAX_CHARS = 500


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
    feedback: Annotated[str, StringConstraints(max_length=FEEDBACK_MAX_CHARS)] | None = None


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
