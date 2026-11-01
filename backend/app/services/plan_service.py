"""Plan use cases: compose the pure domain engines into the API's response shapes.

Stateless: every function takes the whole plan from the request and returns a fresh result.
Routers stay thin (HTTP only); the domain modules stay pure (no I/O, no API models).
"""

from __future__ import annotations

from app.api.v1.plan_models import (
    BudgetTotalsOut,
    CategoryMetricsOut,
    DatePreviewRequest,
    DatePreviewResponse,
    DietCoverageOut,
    NextActionOut,
    OverdueTaskOut,
    Plan,
    ShiftedTaskOut,
    StarterTaskOut,
    SummaryResponse,
    TaskUrgencyOut,
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
from app.domain.guests import DietCounts, DietCoverage, diet_coverage, validate_diet_counts
from app.domain.insights import next_best_actions, task_urgencies
from app.domain.quote_compare import compare_quotes
from app.domain.schedule import detect_overlaps, outside_window
from app.domain.templates import build_template
from app.domain.timeline_engine import is_overdue, preview_date_change


def _diet_counts(plan: Plan) -> DietCounts | None:
    g = plan.guests
    return None if g is None else DietCounts(g.veg, g.non_veg, g.jain, g.eggetarian, g.vegan)


def starter_template(body: TemplateRequest) -> TemplateResponse:
    """Budget split and starter checklist for an event type, counted back from its date."""
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


def summarize(plan: Plan) -> SummaryResponse:
    """Budget totals and status, overdue tasks, diet coverage, task urgency and the
    Next best actions for the Overview."""
    today = today_in(plan.event.timezone)
    event_date = plan.event.event_date
    summary = budget_summary(plan.budget_categories, plan.expenses)
    budget_total = plan.event.budget_total_paise
    counts = _diet_counts(plan)
    cov: DietCoverage | None = diet_coverage(counts, plan.ideas) if counts is not None else None
    coverage = (
        DietCoverageOut(
            covered=cov.covered, uncovered=cov.uncovered, fully_covered=cov.fully_covered
        )
        if cov is not None
        else None
    )
    actions = next_best_actions(
        plan.tasks,
        today,
        event_date,
        summary.categories,
        counts,
        cov,
        detect_overlaps(plan.schedule_items),
        outside_window(plan.schedule_items, plan.functions),
        {f.id: f.name for f in plan.functions},
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
        task_urgency=[
            TaskUrgencyOut(task_id=u.task_id, level=u.level, reason=u.reason)
            for u in task_urgencies(plan.tasks, today, event_date).values()
        ],
        next_actions=[NextActionOut(**a.__dict__) for a in actions],
    )


def preview_new_date(body: DatePreviewRequest) -> DatePreviewResponse:
    """What moving the event date would do to every task, before anything changes."""
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


def _dependency_problems(plan: Plan) -> list[ValidationProblem]:
    cycle = detect_cycle(plan.tasks)
    if not cycle.has_cycle:
        return []
    return [
        ValidationProblem(
            code="dependency_cycle",
            severity="error",
            message="Some tasks depend on each other in a loop.",
            refs=cycle.cycle_task_ids,
        )
    ]


def _diet_problems(plan: Plan) -> list[ValidationProblem]:
    counts = _diet_counts(plan)
    if plan.guests is None or counts is None:
        return []
    total = plan.guests.total
    check = validate_diet_counts(total, counts)
    if check.difference > 0:
        return [
            ValidationProblem(
                code="diet_total_exceeds_guests",
                severity="error",
                message=f"Diet groups add up to {check.sum}, more than {total} guests.",
                refs=[],
            )
        ]
    if check.difference < 0:
        return [
            ValidationProblem(
                code="diet_total_mismatch",
                severity="warning",
                message=f"Diet groups add up to {check.sum} of {total} guests.",
                refs=[],
            )
        ]
    return []


def _schedule_problems(plan: Plan) -> list[ValidationProblem]:
    problems = [
        ValidationProblem(
            code="schedule_overlap",
            severity="warning",
            message="Two schedule items overlap in the same function.",
            refs=[overlap.item_a_id, overlap.item_b_id],
        )
        for overlap in detect_overlaps(plan.schedule_items)
    ]
    problems += [
        ValidationProblem(
            code="schedule_outside_window",
            severity="warning",
            message="A schedule item falls outside its function's start and end time.",
            refs=[item_id],
        )
        for item_id in outside_window(plan.schedule_items, plan.functions)
    ]
    return problems


def _quote_problems(plan: Plan) -> list[ValidationProblem]:
    guest_basis = plan.guests.total if plan.guests else plan.event.guest_estimate
    return [
        ValidationProblem(
            code="quote_missing_units",
            severity="warning",
            message="A per-plate or per-guest quote has no unit count; the guest count was "
            "used instead.",
            refs=[quote.id],
        )
        for quote in compare_quotes(plan.quotes, guest_basis)
        if quote.missing_units
    ]


def validate(plan: Plan) -> ValidateResponse:
    """Cross-field checks the schema cannot express. Errors make the plan invalid."""
    problems = [
        *_dependency_problems(plan),
        *_diet_problems(plan),
        *_schedule_problems(plan),
        *_quote_problems(plan),
    ]
    return ValidateResponse(
        valid=not any(p.severity == "error" for p in problems), problems=problems
    )
