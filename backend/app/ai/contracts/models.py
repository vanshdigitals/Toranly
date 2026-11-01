"""AI contract models, contract version 1.0 (AI_SCHEMAS.md §2 to §4).

Input: `PlanContext` sent by the browser and re-validated here. It carries no notes, names,
emails, phone numbers, vendor names or exact dates (NFR-10).
Output: one `Envelope` per contract, restricted to that contract's item kinds.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CONTRACT_VERSION = "1.0"

Key = Annotated[str, StringConstraints(pattern=r"^[a-z_]{2,30}$")]


T20 = Annotated[str, StringConstraints(max_length=20)]
T30 = Annotated[str, StringConstraints(max_length=30)]
T40 = Annotated[str, StringConstraints(max_length=40)]
T60 = Annotated[str, StringConstraints(max_length=60)]
T80 = Annotated[str, StringConstraints(max_length=80)]
T120 = Annotated[str, StringConstraints(max_length=120)]
T200 = Annotated[str, StringConstraints(max_length=200)]
T300 = Annotated[str, StringConstraints(max_length=300)]
Title = Annotated[str, StringConstraints(min_length=3, max_length=120)]


class DietGroup(StrEnum):
    veg = "veg"
    non_veg = "non_veg"
    jain = "jain"
    eggetarian = "eggetarian"
    vegan = "vegan"


class EventType(StrEnum):
    wedding = "wedding"
    engagement = "engagement"
    birthday = "birthday"
    anniversary = "anniversary"
    community = "community"
    family = "family"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Input -----------------------------------------------------------------------------------


class AiPreferences(Strict):
    """EventPreferences without `notes`: free-form notes never leave the browser."""

    theme_words: list[T30] = Field(default_factory=list, max_length=5)
    diet_focus: list[DietGroup] = Field(default_factory=list, max_length=5)
    customs: list[T40] = Field(default_factory=list, max_length=10)
    avoid_colours: list[T20] = Field(default_factory=list, max_length=5)


GuestBand = Literal["1-25", "26-75", "76-150", "151-300", "301-600", "600+"]


class PlanContext(Strict):
    event_type: EventType
    month: Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
    days_until_event: Annotated[int, Field(ge=0, le=1500)]
    city: T80 | None = None
    guest_band: GuestBand
    budget_total_inr: Annotated[int, Field(ge=0, le=100_000_000_000)]
    diet_counts: dict[DietGroup, Annotated[int, Field(ge=0, le=100_000)]] = Field(
        default_factory=dict
    )
    functions: list[T60] = Field(default_factory=list, max_length=10)
    preferences: AiPreferences = Field(default_factory=AiPreferences)
    existing_category_keys: list[Key] = Field(default_factory=list, max_length=60)
    existing_task_titles: list[T120] = Field(default_factory=list, max_length=200)
    rejected_reasons: list[T200] = Field(default_factory=list, max_length=20)


# --- Output items ----------------------------------------------------------------------------


class BudgetShare(Strict):
    kind: Literal["budget_share"]
    category_key: Key
    label: T40
    share_pct: Annotated[float, Field(ge=0, le=100)]
    rationale: T300


class TaskItem(Strict):
    kind: Literal["task"]
    title: Title
    offset_days: Annotated[int, Field(ge=0, le=730)]
    category_key: Key | None
    is_milestone: bool
    depends_on_titles: list[T120] = Field(max_length=5)


class ThemeIdea(Strict):
    kind: Literal["theme_idea"]
    title: T60
    description: T300
    palette_words: list[T20] = Field(max_length=5)


class DecorIdea(Strict):
    kind: Literal["decor_idea"]
    title: T60
    description: T300
    estimate_inr_min: Annotated[int, Field(ge=0)] | None
    estimate_inr_max: Annotated[int, Field(ge=0)] | None


Course = Literal["welcome_drink", "starter", "main", "bread_rice", "dessert", "beverage", "snack"]


class MenuItem(Strict):
    kind: Literal["menu_item"]
    course: Course
    dish_name: T60
    diet_tags: list[DietGroup] = Field(min_length=1, max_length=5)
    allergen_notes: T120 | None


class VendorCategory(Strict):
    kind: Literal["vendor_category"]
    category_key: Key
    label: T40
    questions_to_ask: list[T120] = Field(max_length=6)
    book_by_offset_days: Annotated[int, Field(ge=0, le=730)]


class SavingIdea(Strict):
    kind: Literal["saving_idea"]
    category_key: Key
    idea: T200
    estimate_saving_inr_min: Annotated[int, Field(ge=0)]
    estimate_saving_inr_max: Annotated[int, Field(ge=0)]
    trade_off: T200


class ScheduleItem(Strict):
    kind: Literal["schedule_item"]
    function_name: T60
    start_time: Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
    duration_min: Annotated[int, Field(ge=5, le=600)]
    title: T80


AnyItem = (
    BudgetShare
    | TaskItem
    | ThemeIdea
    | DecorIdea
    | MenuItem
    | VendorCategory
    | SavingIdea
    | ScheduleItem
)
