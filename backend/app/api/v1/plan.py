"""Plan endpoints: HTTP only. The use cases live in app/services/plan_service.py.

Stateless: requests carry the whole plan; nothing is stored.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import api_rate_limit
from app.api.v1.plan_models import (
    DatePreviewRequest,
    DatePreviewResponse,
    PlanRequest,
    SummaryResponse,
    TemplateRequest,
    TemplateResponse,
    ValidateResponse,
)
from app.services import plan_service

router = APIRouter(prefix="/plan", tags=["plan"], dependencies=[Depends(api_rate_limit)])


@router.post("/template", response_model=TemplateResponse, response_model_by_alias=True)
def plan_template(body: TemplateRequest) -> TemplateResponse:
    """Starter budget split and checklist for an event type."""
    return plan_service.starter_template(body)


@router.post("/summary", response_model=SummaryResponse, response_model_by_alias=True)
def plan_summary(body: PlanRequest) -> SummaryResponse:
    """Budget totals and status, overdue tasks and diet coverage."""
    return plan_service.summarize(body.plan)


@router.post("/date-preview", response_model=DatePreviewResponse, response_model_by_alias=True)
def plan_date_preview(body: DatePreviewRequest) -> DatePreviewResponse:
    """Preview of a date change; nothing is applied."""
    return plan_service.preview_new_date(body)


@router.post("/validate", response_model=ValidateResponse, response_model_by_alias=True)
def plan_validate(body: PlanRequest) -> ValidateResponse:
    """Cross-field problems (cycles, diet totals, schedule, quotes)."""
    return plan_service.validate(body.plan)
