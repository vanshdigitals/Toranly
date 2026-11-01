from __future__ import annotations

import pytest

from app.ai.contracts import CONTRACTS
from app.ai.contracts.models import PlanContext
from app.ai.guards import apply_guards, scrub_text
from tests.ai.sample import context
from tests.fakes import recorded


@pytest.mark.parametrize(
    "text",
    [
        "Call +91 98765 43210 today",
        "Call 9876543210 today",
        "Call 98765-43210 today",
        "Call 098765 43210 today",
        "Call 011-23456789 today",
        "Call +1 (415) 555-0100 today",
        "Call (415) 555-0100 today",
        "Call 1800-123-4567 today",
        "Call +44 20 7946 0958 today",
        "Mail hello@example.com today",
        "See https://example.com/x?y=1 today",
        "See www.example.in today",
        "See example-decor.co.in today",
    ],
)
def test_scrub_removes_contacts_and_urls(text: str) -> None:
    out = scrub_text(text)
    assert out.startswith(("Call", "Mail", "See")) and out.endswith("today")
    assert not any(ch.isdigit() for ch in out) and "@" not in out and "http" not in out
    assert ".com" not in out and ".in" not in out


def test_scrub_keeps_ordinary_text_and_indic_scripts() -> None:
    assert scrub_text("60 guests, 3 courses, starts 17:00") == "60 guests, 3 courses, starts 17:00"
    assert scrub_text("स्वागत‍पेय") == "स्वागत‍पेय"
    assert scrub_text("bad‮override\x00 <b>") == "badoverride b"


def _items(name: str, fixture: str) -> list:  # type: ignore[type-arg]
    env = CONTRACTS[name].envelope.model_validate_json(recorded(fixture), strict=True)
    return list(env.items)  # type: ignore[attr-defined]


def test_guards_strip_contacts_drop_booking_claims_and_unlisted_customs() -> None:
    ctx = PlanContext.model_validate(context())
    result = apply_guards(_items("theme.suggest", "injection_influenced.json"), ctx)
    titles = [i["title"] for i in result.items]
    assert titles == ["Royal blue night", "Lanterns"]  # booked claim and 'mehendi' dropped
    assert "98765" not in result.items[0]["description"]
    assert "www." not in result.items[0]["description"]
    assert "@" not in result.items[1]["description"]
    assert result.dropped == 2


def test_customs_allowed_when_listed_or_in_function_names() -> None:
    ctx = PlanContext.model_validate(context(functions=["Mehendi & High Tea"]))
    result = apply_guards(_items("theme.suggest", "injection_influenced.json"), ctx)
    assert "Mehendi corner" in [i["title"] for i in result.items]


def test_task_guards_dedupe_unresolved_deps_and_past_due() -> None:
    ctx = PlanContext.model_validate(context(days_until_event=20))
    result = apply_guards(_items("timeline.suggest", "timeline_suggest.valid.json"), ctx)
    titles = [i["title"] for i in result.items]
    assert "Confirm final headcount with catering" not in titles  # already exists
    cake = next(i for i in result.items if i["title"] == "Order the birthday cake")
    assert cake["depends_on_titles"] == ["Choose the party venue"]
    assert "past_due: Fix the guest list draft" in result.warnings
    assert "past_due: Choose the party venue" in result.warnings


def test_task_cycles_are_removed() -> None:
    ctx = PlanContext.model_validate(context())
    items = (
        CONTRACTS["timeline.suggest"]
        .envelope.model_validate(
            {
                "contract_version": "1.0",
                "items": [
                    {
                        "kind": "task",
                        "title": "Task one",
                        "offset_days": 5,
                        "category_key": None,
                        "is_milestone": False,
                        "depends_on_titles": ["Task two"],
                    },
                    {
                        "kind": "task",
                        "title": "Task two",
                        "offset_days": 4,
                        "category_key": None,
                        "is_milestone": False,
                        "depends_on_titles": ["Task one"],
                    },
                ],
                "assumptions": [],
                "warnings": [],
                "refusal": None,
            }
        )
        .items
    )  # type: ignore[attr-defined]
    result = apply_guards(list(items), ctx)
    assert all(i["depends_on_titles"] == [] for i in result.items)


def test_budget_shares_rescaled_to_exactly_100() -> None:
    ctx = PlanContext.model_validate(context())
    result = apply_guards(_items("budget.suggest", "budget_suggest.valid.json"), ctx)
    shares = [i["share_pct"] for i in result.items]
    assert round(sum(shares), 2) == 100.0
    assert shares == [33.34, 33.33, 33.33]


def test_budget_shares_far_from_100_are_dropped() -> None:
    ctx = PlanContext.model_validate(context())
    items = _items("plan.generate", "plan_generate.valid.json")
    result = apply_guards(items, ctx)  # shares sum to 101: kept and rescaled
    assert sum(1 for i in result.items if i["kind"] == "budget_share") == 4
    shares = [i for i in items if i.kind == "budget_share"]
    shares[0] = shares[0].model_copy(update={"share_pct": 60})
    result = apply_guards(shares, ctx)
    assert result.items == [] and "budget_shares_inconsistent" in result.warnings


def test_estimates_swapped_and_clamped_to_budget() -> None:
    ctx = PlanContext.model_validate(context())
    result = apply_guards(_items("plan.generate", "plan_generate.valid.json"), ctx)
    decor = next(i for i in result.items if i["kind"] == "decor_idea")
    assert (decor["estimate_inr_min"], decor["estimate_inr_max"]) == (4000, 9000)
    small = PlanContext.model_validate(context(budget_total_inr=5000))
    result = apply_guards(_items("plan.generate", "plan_generate.valid.json"), small)
    assert not any(i["kind"] == "decor_idea" for i in result.items)


def test_menu_coverage_warnings() -> None:
    ctx = PlanContext.model_validate(context())
    result = apply_guards(_items("menu.suggest", "menu_suggest.valid.json"), ctx)
    assert "diet_not_covered: non_veg" in result.warnings
    assert not any("jain" in w for w in result.warnings)


def test_schedule_unknown_function_dropped_and_overlap_warned() -> None:
    ctx = PlanContext.model_validate(context())
    result = apply_guards(_items("schedule.draft", "schedule_draft.valid.json"), ctx)
    assert [i["title"] for i in result.items] == ["Welcome and games", "Magic show"]
    assert any(w.startswith("overlap:") for w in result.warnings)
