"""Stateless Python reference endpoints for the deterministic domain engines.

Nothing is stored. Requests carry the whole plan; responses are computed and discarded.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import api_rate_limit
from app.api.v1.plan_models import (
    BudgetTotalsOut,
    CategoryMetricsOut,
    DatePreviewRequest,
    DatePreviewResponse,
    DietCoverageOut,
    OverdueTaskOut,
    PlanRequest,
    ShiftedTaskOut,
    StarterTaskOut,
    SummaryResponse,
    TemplateCategoryOut,
    TemplateRequest,
    TemplateResponse,
    UnchangedTaskOut,
    ValidateResponse,
    ValidationProblem,
)
from app.core.clock import today_in
from app.core.errors import ProblemError
from app.domain.budget_engine import budget_summary
from app.domain.dependency_graph import detect_cycle
from app.domain.guests import DietCounts, diet_coverage, validate_diet_counts
from app.domain.quote_compare import compare_quotes
from app.domain.schedule import detect_overlaps, outside_window
from app.domain.templates import build_template
from app.domain.timeline_engine import is_overdue, preview_date_change

router = APIRouter(prefix="/plan", tags=["plan"], dependencies=[Depends(api_rate_limit)])


@router.post("/template", response_model=TemplateResponse, response_model_by_alias=True)
def plan_template(body: TemplateRequest) -> TemplateResponse:
    result = build_template(body.type, body.budget_total_paise, body.event_date)
    return TemplateResponse(
        type=body.type,
        budget_total_paise=body.budget_total_paise,
        event_date=body.event_date,
        categories=[TemplateCategoryOut(**c.__dict__) for c in result.categories],
        tasks=[
            StarterTaskOut(**{**t.__dict__, "depends_on_positions": list(t.depends_on_positions)})
            for t in result.tasks
        ],
    )


@router.post("/summary", response_model=SummaryResponse, response_model_by_alias=True)
def plan_summary(body: PlanRequest) -> SummaryResponse:
    plan = body.plan
    today = today_in(plan.event.timezone)
    summary = budget_summary(plan.budget_categories, plan.expenses)
    budget_total = plan.event.budget_total_paise
    coverage = None
    if plan.guests is not None:
        g = plan.guests
        cov = diet_coverage(DietCounts(g.veg, g.non_veg, g.jain, g.eggetarian, g.vegan), plan.ideas)
        coverage = DietCoverageOut(
            covered=cov.covered, uncovered=cov.uncovered, fully_covered=cov.fully_covered
        )
    return SummaryResponse(
        today=today,
        budget=BudgetTotalsOut(
            allocated_paise=summary.total_allocated_paise,
            planned_paise=summary.total_planned_paise,
            quoted_paise=summary.total_quoted_paise,
            paid_paise=summary.total_paid_paise,
            committed_paise=summary.total_committed_paise,
            remaining_paise=summary.total_remaining_paise,
            unallocated_paise=(
                budget_total - summary.total_allocated_paise if budget_total is not None else None
            ),
            status=summary.overall_status,
            percent_committed=summary.percent_committed,
        ),
        categories=[CategoryMetricsOut(**m.__dict__) for m in summary.categories],
        overdue_tasks=[
            OverdueTaskOut(id=t.id, title=t.title, due_date=t.due_date)
            for t in plan.tasks
            if t.due_date is not None and is_overdue(t.due_date, t.status, today)
        ],
        diet_coverage=coverage,
    )


@router.post("/date-preview", response_model=DatePreviewResponse, response_model_by_alias=True)
def plan_date_preview(body: DatePreviewRequest) -> DatePreviewResponse:
    plan = body.plan
    if plan.event.event_date is None:
        raise ProblemError(
            422, "event_date_missing", "Set the event date before previewing a date change."
        )
    preview = preview_date_change(
        plan.tasks,
        plan.event.event_date,
        body.new_date,
        today_in(plan.event.timezone),
        shift_fixed_tasks=body.shift_fixed_tasks,
    )
    return DatePreviewResponse(
        old_date=preview.old_date,
        new_date=preview.new_date,
        delta_days=preview.delta_days,
        shifted=[ShiftedTaskOut(**s.__dict__) for s in preview.shifted],
        unchanged=[UnchangedTaskOut(**u.__dict__) for u in preview.unchanged_fixed],
        now_overdue=preview.now_overdue,
    )


@router.post("/validate", response_model=ValidateResponse, response_model_by_alias=True)
def plan_validate(body: PlanRequest) -> ValidateResponse:
    plan = body.plan
    problems: list[ValidationProblem] = []

    cycle = detect_cycle(plan.tasks)
    if cycle.has_cycle:
        problems.append(
            ValidationProblem(
                code="dependency_cycle",
                severity="error",
                message="Some tasks depend on each other in a loop.",
                refs=cycle.cycle_task_ids,
            )
        )

    if plan.guests is not None:
        g = plan.guests
        check = validate_diet_counts(
            g.total, DietCounts(g.veg, g.non_veg, g.jain, g.eggetarian, g.vegan)
        )
        if check.difference > 0:
            problems.append(
                ValidationProblem(
                    code="diet_total_exceeds_guests",
                    severity="error",
                    message=f"Diet groups add up to {check.sum}, more than {g.total} guests.",
                    refs=[],
                )
            )
        elif check.difference < 0:
            problems.append(
                ValidationProblem(
                    code="diet_total_mismatch",
                    severity="warning",
                    message=f"Diet groups add up to {check.sum} of {g.total} guests.",
                    refs=[],
                )
            )

    for overlap in detect_overlaps(plan.schedule_items):
        problems.append(
            ValidationProblem(
                code="schedule_overlap",
                severity="warning",
                message="Two schedule items overlap in the same function.",
                refs=[overlap.item_a_id, overlap.item_b_id],
            )
        )
    for item_id in outside_window(plan.schedule_items, plan.functions):
        problems.append(
            ValidationProblem(
                code="schedule_outside_window",
                severity="warning",
                message="A schedule item falls outside its function's start and end time.",
                refs=[item_id],
            )
        )

    guest_basis = plan.guests.total if plan.guests else plan.event.guest_estimate
    for quote in compare_quotes(plan.quotes, guest_basis):
        if quote.missing_units:
            problems.append(
                ValidationProblem(
                    code="quote_missing_units",
                    severity="warning",
                    message="A per-plate or per-guest quote has no unit count; the guest "
                    "count was used instead.",
                    refs=[quote.id],
                )
            )

    return ValidateResponse(
        valid=not any(p.severity == "error" for p in problems), problems=problems
    )
