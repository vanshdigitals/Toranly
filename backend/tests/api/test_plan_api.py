from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

import app.services.plan_service as plan_module


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(plan_module, "today_in", lambda tz: date(2026, 10, 28))


def plan(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "schemaVersion": 1,
        "id": "plan-1",
        "createdAt": "2026-10-01T10:00:00.000Z",
        "updatedAt": "2026-10-01T10:00:00.000Z",
        "wizardStep": 4,
        "status": "active",
        "event": {
            "type": "birthday",
            "title": "Aarav turns 7",
            "eventDate": "2027-02-14",
            "timezone": "Asia/Kolkata",
            "city": "Noida",
            "guestEstimate": 60,
            "budgetTotalPaise": 7_500_000,
            "currency": "INR",
            "preferences": {
                "themeWords": ["garden"],
                "dietFocus": ["veg"],
                "customs": [],
                "avoidColours": [],
                "notes": "private note",
            },
        },
        "functions": [
            {
                "id": "fn-1",
                "name": "Party",
                "date": "2027-02-14",
                "startTime": "17:00",
                "endTime": "21:30",
                "position": 1,
            }
        ],
        "budgetCategories": [
            {
                "id": "cat-food",
                "key": "catering",
                "label": "Food",
                "allocatedPaise": 2_625_000,
                "position": 1,
                "source": "ai",
            },
            {
                "id": "cat-venue",
                "key": "venue",
                "label": "Venue",
                "allocatedPaise": 1_875_000,
                "position": 2,
            },
        ],
        "expenses": [
            {
                "id": "e1",
                "categoryId": "cat-food",
                "description": "Caterer quote",
                "amountPaise": 2_800_000,
                "kind": "quoted",
            },
            {
                "id": "e2",
                "categoryId": "cat-food",
                "description": "Advance",
                "amountPaise": 500_000,
                "kind": "paid",
            },
        ],
        "tasks": [
            {
                "id": "t1",
                "title": "Reserve venue",
                "offsetDays": 120,
                "dueDate": "2026-10-17",
                "dependsOn": [],
            },
            {
                "id": "t2",
                "title": "Order cake",
                "offsetDays": 18,
                "dueDate": "2027-01-27",
                "dependsOn": ["t1"],
            },
            {"id": "t3", "title": "Print banner", "dateMode": "fixed", "dueDate": "2026-12-01"},
        ],
        "vendors": [],
        "quotes": [],
        "guests": {"total": 60, "veg": 40, "nonVeg": 12, "jain": 8, "eggetarian": 0, "vegan": 0},
        "scheduleItems": [],
        "ideas": [
            {"id": "i1", "kind": "menu", "title": "Paneer", "dietTags": ["veg", "jain"]},
            # Every field the browser stores (web/src/domain/plan.ts), including AI sources.
            {
                "id": "i2",
                "kind": "saving",
                "title": "Reuse flowers",
                "source": "ai",
                "confirmed": True,
                "personalized": True,
                "personalNote": "Ask the decorator",
            },
        ],
    }
    data.update(overrides)
    return data


def test_template(client: TestClient) -> None:
    r = client.post(
        "/api/v1/plan/template",
        json={"type": "birthday", "budgetTotalPaise": 7_500_001, "eventDate": "2027-02-14"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert sum(c["allocatedPaise"] for c in body["categories"]) == 7_500_001
    assert body["categories"][0] == {
        "key": "venue",
        "label": "Party Venue",
        "sharePercent": 25,
        "allocatedPaise": 1_875_000,
        "position": 1,
    }
    # The one leftover paisa goes to the largest remainder: catering (35% -> .35 paise).
    assert body["categories"][1]["allocatedPaise"] == 2_625_001
    assert body["tasks"][0]["dueDate"] == "2027-01-15"
    assert body["tasks"][0]["offsetDays"] == 30


def test_template_null_budget_and_date(client: TestClient) -> None:
    body = client.post(
        "/api/v1/plan/template",
        json={"type": "wedding", "budgetTotalPaise": None, "eventDate": None},
    ).json()
    assert all(c["allocatedPaise"] == 0 for c in body["categories"])
    assert body["tasks"][1]["dependsOnPositions"] == [1]
    assert all(t["dueDate"] is None for t in body["tasks"])


def test_summary(client: TestClient) -> None:
    r = client.post("/api/v1/plan/summary", json={"plan": plan()})
    assert r.status_code == 200, r.text
    body = r.json()
    food = body["categories"][0]
    assert food["committedPaise"] == 2_800_000 and food["status"] == "over"
    assert body["budget"]["committedPaise"] == 2_800_000
    assert body["budget"]["unallocatedPaise"] == 3_000_000
    assert body["budget"]["status"] == "ok"
    assert [t["id"] for t in body["overdueTasks"]] == ["t1"]
    assert body["dietCoverage"] == {
        "covered": ["veg", "jain"],
        "uncovered": ["nonVeg"],
        "fullyCovered": False,
    }


def test_summary_next_actions_explain_the_plan(client: TestClient) -> None:
    body = client.post("/api/v1/plan/summary", json={"plan": plan()}).json()
    actions = body["nextActions"]
    assert 1 <= len(actions) <= 5
    assert all(a["title"] and a["reason"] and a["tab"] for a in actions)
    kinds = [a["kind"] for a in actions]
    # The overdue task comes first, then the over-budget food category with a rebalance hint.
    assert kinds[0] in ("task", "blocked_task")
    over = next(a for a in actions if a["kind"] == "budget_over")
    assert over["reason"].startswith("Over by ") and over["tab"] == "budget"
    assert {u["taskId"]: u["level"] for u in body["taskUrgency"]}["t1"] == "urgent"


def test_date_preview(client: TestClient) -> None:
    r = client.post(
        "/api/v1/plan/date-preview",
        json={"plan": plan(), "newDate": "2027-03-01", "shiftFixedTasks": False},
    )
    body = r.json()
    assert body["deltaDays"] == 15
    assert [(s["id"], s["newDue"]) for s in body["shifted"]] == [
        ("t1", "2026-11-01"),
        ("t2", "2027-02-11"),
    ]
    assert [u["id"] for u in body["unchanged"]] == ["t3"]
    assert body["nowOverdue"] == []
    shifted = client.post(
        "/api/v1/plan/date-preview",
        json={"plan": plan(), "newDate": "2027-01-14", "shiftFixedTasks": True},
    ).json()
    assert ("t3", "2026-10-31") in [(s["id"], s["newDue"]) for s in shifted["shifted"]]
    assert shifted["nowOverdue"] == ["t1"]


def test_date_preview_needs_event_date(client: TestClient) -> None:
    p = plan()
    p["event"] = {**p["event"], "eventDate": None}
    r = client.post("/api/v1/plan/date-preview", json={"plan": p, "newDate": "2027-03-01"})
    assert r.status_code == 422 and r.json()["code"] == "event_date_missing"


def test_validate(client: TestClient) -> None:
    p = plan(
        tasks=[
            {"id": "a", "title": "A", "dependsOn": ["b"]},
            {"id": "b", "title": "B", "dependsOn": ["a"]},
        ],
        guests={"total": 50, "veg": 40, "nonVeg": 12},
        scheduleItems=[
            {
                "id": "s1",
                "functionId": "fn-1",
                "startTime": "16:30",
                "durationMin": 60,
                "title": "Setup",
            },
            {
                "id": "s2",
                "functionId": "fn-1",
                "startTime": "17:00",
                "durationMin": 30,
                "title": "Games",
            },
        ],
        quotes=[{"id": "q1", "vendorId": "v1", "amountPaise": 40000, "unit": "per_plate"}],
    )
    body = client.post("/api/v1/plan/validate", json={"plan": p}).json()
    codes = [(x["code"], x["severity"]) for x in body["problems"]]
    assert codes == [
        ("dependency_cycle", "error"),
        ("diet_total_exceeds_guests", "error"),
        ("schedule_overlap", "warning"),
        ("schedule_outside_window", "warning"),
        ("quote_missing_units", "warning"),
    ]
    assert body["valid"] is False
    ok = client.post("/api/v1/plan/validate", json={"plan": plan()}).json()
    assert ok == {"valid": True, "problems": []}


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update({"unknownField": 1}),
        lambda p: p["event"].update({"secret": "x"}),
        lambda p: p["tasks"][0].update({"assignee": "Priya"}),
        lambda p: p["event"].update({"timezone": "Mars/Base"}),
        lambda p: p["event"].update({"guestEstimate": 10_001}),
        lambda p: p["expenses"][0].update({"amountPaise": -1}),
        lambda p: p.update({"tasks": [{"id": f"t{i}", "title": "x"} for i in range(501)]}),
        lambda p: p["event"].update({"title": "x" * 121}),
    ],
)
def test_plan_rejects_unknown_fields_and_bounds(client: TestClient, mutate: Any) -> None:
    p = plan()
    mutate(p)
    r = client.post("/api/v1/plan/summary", json={"plan": p})
    assert r.status_code in (413, 422)


def test_health(client: TestClient) -> None:
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_readiness_without_database(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.v1.health as health

    monkeypatch.setattr(health, "READY_TIMEOUT_SECONDS", 2)
    r = client.get("/api/v1/health/ready")
    assert r.status_code == 503 and r.json()["code"] == "database_unavailable"
