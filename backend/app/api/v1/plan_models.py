"""Request models mirroring the web app's Plan v1 schema (web/src/domain/plan.ts).

Field names are camelCase on the wire, snake_case in Python. Unknown fields are rejected and
every string, number and list is bounded. Defaults match the Zod schema's defaults.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

Id = Annotated[str, StringConstraints(min_length=1, max_length=100)]
ShortText = Annotated[str, StringConstraints(max_length=60)]
HHMM = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Paise = Annotated[int, Field(ge=0, le=10_000_000_000_000)]
Timestamp = Annotated[str, StringConstraints(max_length=40)]
EventType = Literal["wedding", "engagement", "birthday", "anniversary", "community", "family"]

_TIMEZONES = frozenset(available_timezones())


class Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", alias_generator=to_camel, populate_by_name=False, frozen=True
    )


class EventPreferences(Model):
    theme_words: list[ShortText] = Field(default_factory=list, max_length=20)
    diet_focus: list[ShortText] = Field(default_factory=list, max_length=10)
    customs: list[ShortText] = Field(default_factory=list, max_length=20)
    avoid_colours: list[ShortText] = Field(default_factory=list, max_length=20)
    notes: Annotated[str, StringConstraints(max_length=500)] = ""


class EventDetails(Model):
    type: EventType
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    event_date: date | None = None
    timezone: Annotated[str, StringConstraints(max_length=64)] = "Asia/Kolkata"
    city: Annotated[str, StringConstraints(max_length=80)] | None = None
    guest_estimate: Annotated[int, Field(ge=0, le=10000)] = 0
    budget_total_paise: Paise | None = None
    currency: Literal["INR"] = "INR"
    preferences: EventPreferences = Field(default_factory=EventPreferences)

    @field_validator("timezone")
    @classmethod
    def _iana(cls, value: str) -> str:
        if value not in _TIMEZONES:
            raise ValueError("Use an IANA time zone such as Asia/Kolkata.")
        return value


class FunctionItem(Model):
    id: Id
    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    function_date: date = Field(alias="date")
    start_time: HHMM | None = None
    end_time: HHMM | None = None
    position: Annotated[int, Field(ge=0, le=10000)] = 1


class BudgetCategory(Model):
    id: Id
    key: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    label: Annotated[str, StringConstraints(max_length=80)]
    allocated_paise: Paise
    position: Annotated[int, Field(ge=0, le=10000)] = 1
    # "ai" once an accepted AI budget split set this amount (shown as "AI idea").
    source: Literal["template", "user", "ai"] | None = None


class ExpenseItem(Model):
    id: Id
    category_id: Id
    vendor_id: Id | None = None
    description: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    amount_paise: Paise
    kind: Literal["planned", "quoted", "paid"]
    spent_on: date | None = None
    note: Annotated[str, StringConstraints(max_length=500)] | None = None


class TaskItem(Model):
    id: Id
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    notes: Annotated[str, StringConstraints(max_length=1000)] | None = None
    category_key: Annotated[str, StringConstraints(max_length=60)] | None = None
    offset_days: Annotated[int, Field(ge=-3650, le=3650)] | None = None
    due_date: date | None = None
    date_mode: Literal["relative", "fixed"] = "relative"
    is_milestone: bool = False
    status: Literal["open", "done"] = "open"
    completed_at: Timestamp | None = None
    source: Literal["template", "user", "ai"] = "template"
    position: Annotated[int, Field(ge=0, le=100000)] = 1
    depends_on: list[Id] = Field(default_factory=list, max_length=50)


class VendorItem(Model):
    id: Id
    category_key: Annotated[str, StringConstraints(max_length=60)]
    name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    phone: Annotated[str, StringConstraints(max_length=40)] | None = None
    email: Annotated[str, StringConstraints(max_length=254)] | None = None
    status: Literal["shortlisted", "booked", "dropped"] = "shortlisted"
    notes: Annotated[str, StringConstraints(max_length=1000)] | None = None


class QuoteItem(Model):
    id: Id
    vendor_id: Id
    amount_paise: Paise
    unit: Literal["total", "per_plate", "per_guest"] = "total"
    units: Annotated[int, Field(ge=0, le=100000)] | None = None
    inclusions: list[ShortText] = Field(default_factory=list, max_length=20)
    valid_until: date | None = None


class GuestsSummary(Model):
    total: Annotated[int, Field(ge=0, le=100000)]
    veg: Annotated[int, Field(ge=0, le=100000)] = 0
    non_veg: Annotated[int, Field(ge=0, le=100000)] = 0
    jain: Annotated[int, Field(ge=0, le=100000)] = 0
    eggetarian: Annotated[int, Field(ge=0, le=100000)] = 0
    vegan: Annotated[int, Field(ge=0, le=100000)] = 0
    allergy_tags: list[ShortText] = Field(default_factory=list, max_length=20)
    accessibility_needs: list[ShortText] = Field(default_factory=list, max_length=10)


class ScheduleItem(Model):
    id: Id
    function_id: Id
    start_time: HHMM
    duration_min: Annotated[int, Field(ge=1, le=1440)]
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    notes: Annotated[str, StringConstraints(max_length=1000)] | None = None
    position: Annotated[int, Field(ge=0, le=100000)] = 1


class IdeaItem(Model):
    id: Id
    kind: Literal["theme", "decor", "menu", "saving", "other"]
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    body: Annotated[str, StringConstraints(max_length=1000)] | None = None
    diet_tags: list[ShortText] = Field(default_factory=list, max_length=10)
    estimate_min_paise: Paise | None = None
    estimate_max_paise: Paise | None = None
    source: Literal["ai", "user"] = "user"
    # Ideas-board state kept by the browser (web/src/domain/plan.ts IdeaItemSchema).
    confirmed: bool | None = None
    personalized: bool | None = None
    personal_note: Annotated[str, StringConstraints(max_length=1000)] | None = None


class Plan(Model):
    schema_version: Literal[1] = 1
    id: Id
    created_at: Timestamp
    updated_at: Timestamp
    wizard_step: Annotated[int, Field(ge=1, le=4)] = 1
    status: Literal["draft", "active", "completed"] = "draft"
    event: EventDetails
    functions: list[FunctionItem] = Field(default_factory=list, max_length=20)
    budget_categories: list[BudgetCategory] = Field(default_factory=list, max_length=60)
    expenses: list[ExpenseItem] = Field(default_factory=list, max_length=1000)
    tasks: list[TaskItem] = Field(default_factory=list, max_length=500)
    vendors: list[VendorItem] = Field(default_factory=list, max_length=200)
    quotes: list[QuoteItem] = Field(default_factory=list, max_length=500)
    guests: GuestsSummary | None = None
    schedule_items: list[ScheduleItem] = Field(default_factory=list, max_length=500)
    ideas: list[IdeaItem] = Field(default_factory=list, max_length=500)


# --- Endpoint request and response bodies ----------------------------------------------------


class TemplateRequest(Model):
    type: EventType
    budget_total_paise: Paise | None = None
    event_date: date | None = None


class PlanRequest(Model):
    plan: Plan


class DatePreviewRequest(Model):
    plan: Plan
    new_date: date
    shift_fixed_tasks: bool = False


class Out(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TemplateCategoryOut(Out):
    key: str
    label: str
    share_percent: int
    allocated_paise: int
    position: int


class StarterTaskOut(Out):
    position: int
    title: str
    category_key: str
    offset_days: int
    due_date: date | None
    is_milestone: bool
    depends_on_positions: list[int]


class TemplateResponse(Out):
    type: EventType
    budget_total_paise: int | None
    event_date: date | None
    categories: list[TemplateCategoryOut]
    tasks: list[StarterTaskOut]


class CategoryMetricsOut(Out):
    category_id: str
    key: str
    label: str
    allocated_paise: int
    planned_paise: int
    quoted_paise: int
    paid_paise: int
    committed_paise: int
    remaining_paise: int
    status: Literal["ok", "warning", "over"]
    percent_committed: int


class BudgetTotalsOut(Out):
    allocated_paise: int
    planned_paise: int
    quoted_paise: int
    paid_paise: int
    committed_paise: int
    remaining_paise: int
    unallocated_paise: int | None
    status: Literal["ok", "warning", "over"]
    percent_committed: int


class OverdueTaskOut(Out):
    id: str
    title: str
    due_date: date


class DietCoverageOut(Out):
    covered: list[str]
    uncovered: list[str]
    fully_covered: bool


class SummaryResponse(Out):
    today: date
    budget: BudgetTotalsOut
    categories: list[CategoryMetricsOut]
    overdue_tasks: list[OverdueTaskOut]
    diet_coverage: DietCoverageOut | None


class ShiftedTaskOut(Out):
    id: str
    title: str
    old_due: date
    new_due: date
    offset_days: int | None
    date_mode: str
    becomes_overdue: bool


class UnchangedTaskOut(Out):
    id: str
    title: str
    due_date: date | None


class DatePreviewResponse(Out):
    old_date: date
    new_date: date
    delta_days: int
    shifted: list[ShiftedTaskOut]
    unchanged: list[UnchangedTaskOut]
    now_overdue: list[str]


class ValidationProblem(Out):
    code: str
    severity: Literal["error", "warning"]
    message: str
    refs: list[str]


class ValidateResponse(Out):
    valid: bool
    problems: list[ValidationProblem]
