"""Contract models reject extra fields and out-of-range values; schemas fit xAI's subset."""

from __future__ import annotations

import json
import re
from typing import Any

import pytest
from pydantic import ValidationError

from app.ai.contracts import CONTRACTS, xai_schema
from app.ai.contracts.models import (
    BudgetShare,
    DecorIdea,
    MenuItem,
    PlanContext,
    SavingIdea,
    ScheduleItem,
    TaskItem,
    ThemeIdea,
    VendorCategory,
)
from tests.ai.sample import context
from tests.fakes import recorded

VALID_ITEMS: dict[type, dict[str, Any]] = {
    BudgetShare: {
        "kind": "budget_share",
        "category_key": "venue",
        "label": "Venue",
        "share_pct": 30,
        "rationale": "r",
    },
    TaskItem: {
        "kind": "task",
        "title": "Book hall",
        "offset_days": 30,
        "category_key": None,
        "is_milestone": True,
        "depends_on_titles": [],
    },
    ThemeIdea: {"kind": "theme_idea", "title": "t", "description": "d", "palette_words": []},
    DecorIdea: {
        "kind": "decor_idea",
        "title": "t",
        "description": "d",
        "estimate_inr_min": 1,
        "estimate_inr_max": 2,
    },
    MenuItem: {
        "kind": "menu_item",
        "course": "main",
        "dish_name": "Dal",
        "diet_tags": ["veg"],
        "allergen_notes": None,
    },
    VendorCategory: {
        "kind": "vendor_category",
        "category_key": "decor",
        "label": "Decorator",
        "questions_to_ask": [],
        "book_by_offset_days": 20,
    },
    SavingIdea: {
        "kind": "saving_idea",
        "category_key": "decor",
        "idea": "i",
        "estimate_saving_inr_min": 1,
        "estimate_saving_inr_max": 2,
        "trade_off": "t",
    },
    ScheduleItem: {
        "kind": "schedule_item",
        "function_name": "Party",
        "start_time": "17:00",
        "duration_min": 30,
        "title": "Games",
    },
}

OUT_OF_RANGE: list[tuple[type, str, Any]] = [
    (BudgetShare, "share_pct", 100.5),
    (BudgetShare, "category_key", "Venue!"),
    (TaskItem, "offset_days", 731),
    (TaskItem, "offset_days", -1),
    (TaskItem, "title", "ab"),
    (TaskItem, "depends_on_titles", ["x"] * 6),
    (ThemeIdea, "palette_words", ["a"] * 6),
    (DecorIdea, "estimate_inr_min", -1),
    (MenuItem, "diet_tags", []),
    (MenuItem, "course", "lunch"),
    (VendorCategory, "questions_to_ask", ["q"] * 7),
    (SavingIdea, "idea", "x" * 201),
    (ScheduleItem, "start_time", "24:00"),
    (ScheduleItem, "duration_min", 4),
]


@pytest.mark.parametrize("model", list(VALID_ITEMS))
def test_items_accept_valid_and_reject_extra_fields(model: type) -> None:
    model.model_validate(VALID_ITEMS[model])
    with pytest.raises(ValidationError):
        model.model_validate({**VALID_ITEMS[model], "vendor_phone": "9876543210"})


@pytest.mark.parametrize(("model", "field", "value"), OUT_OF_RANGE)
def test_items_reject_out_of_range(model: type, field: str, value: Any) -> None:
    with pytest.raises(ValidationError):
        model.model_validate({**VALID_ITEMS[model], field: value})


def test_envelope_restricts_kinds_per_contract() -> None:
    env = CONTRACTS["menu.suggest"].envelope
    with pytest.raises(ValidationError):
        env.model_validate_json(recorded("timeline_suggest.valid.json"), strict=True)
    CONTRACTS["timeline.suggest"].envelope.model_validate_json(
        recorded("timeline_suggest.valid.json"), strict=True
    )


def test_envelope_requires_refusal_key_and_version() -> None:
    env = CONTRACTS["theme.suggest"].envelope
    data = json.loads(recorded("theme_suggest.valid.json"))
    del data["refusal"]
    with pytest.raises(ValidationError):
        env.model_validate(data)
    with pytest.raises(ValidationError):
        env.model_validate(
            {**json.loads(recorded("theme_suggest.valid.json")), "contract_version": "2.0"}
        )


def test_plan_context_has_no_personal_fields() -> None:
    fields = set(PlanContext.model_fields) | set(
        PlanContext.model_fields["preferences"].annotation.model_fields  # type: ignore[union-attr]
    )
    forbidden = {"notes", "name", "names", "email", "phone", "vendor", "vendors", "event_date"}
    assert not fields & forbidden
    assert not any(
        f == "date" or f.endswith("_date") or "email" in f or "phone" in f for f in fields
    )


@pytest.mark.parametrize(
    "bad",
    [
        {"preferences": {"notes": "Call Priya on 9876543210"}},
        {"notes": "anything"},
        {"event_date": "2027-02-14"},
        {"guest_names": ["Asha"]},
        {"vendor_names": ["Sharma Caterers"]},
        {"month": "2027-02-14"},
        {"days_until_event": 1501},
        {"guest_band": "60"},
    ],
)
def test_plan_context_rejects_personal_data_and_bad_values(bad: dict[str, Any]) -> None:
    data = context()
    for key, value in bad.items():
        if key == "preferences":
            data["preferences"] = {**data["preferences"], **value}
        else:
            data[key] = value
    with pytest.raises(ValidationError):
        PlanContext.model_validate(data)


# --- xAI JSON Schema subset ------------------------------------------------------------------

ALLOWED_KEYWORDS = {
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum",
    "const",
    "anyOf",
    "$ref",
    "$defs",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "pattern",
    "description",
    "default",
}
UNSUPPORTED_REGEX = re.compile(r"\\b|\(\?[=!<]|\\[1-9]|\(\?[imsx]")


def _walk(node: Any, path: str, problems: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ("properties", "$defs"):
                for name, sub in value.items():
                    _walk(sub, f"{path}.{key}.{name}", problems)
                continue
            if key not in ALLOWED_KEYWORDS:
                problems.append(f"{path}: keyword {key!r} not in the xAI-supported subset")
            if key in ("minLength", "maxLength") and value > 2048:
                problems.append(f"{path}: {key} {value} > 2048")
            if key in ("minItems", "maxItems") and value > 256:
                problems.append(f"{path}: {key} {value} > 256")
            if key in ("enum", "anyOf") and not value:
                problems.append(f"{path}: empty {key}")
            if key == "items" and isinstance(value, list):
                problems.append(f"{path}: tuple-style items")
            if key == "pattern" and UNSUPPORTED_REGEX.search(value):
                problems.append(f"{path}: unsupported regex feature in {value!r}")
            if (
                key == "type"
                and value == "object"
                and node.get("additionalProperties") is not False
            ):
                problems.append(f"{path}: object without additionalProperties false")
            _walk(value, f"{path}.{key}", problems)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _walk(v, f"{path}[{i}]", problems)
    elif isinstance(node, bool) and path.endswith(("properties", "items")):
        problems.append(f"{path}: boolean schema")


@pytest.mark.parametrize("name", list(CONTRACTS))
def test_schema_fits_xai_subset(name: str) -> None:
    problems: list[str] = []
    schema = xai_schema(CONTRACTS[name])
    _walk(schema, name, problems)
    assert problems == []
    # Every object property is required, so the model always returns every key.
    for sub in [schema, *schema.get("$defs", {}).values()]:
        if sub.get("type") == "object":
            assert set(sub["required"]) == set(sub["properties"])


def test_schema_has_no_contact_or_booking_fields() -> None:
    text = json.dumps([xai_schema(c) for c in CONTRACTS.values()]).lower()
    for word in ("phone", "email", "url", "address", "vendor_name", "booked", "booking"):
        assert f'"{word}' not in text
