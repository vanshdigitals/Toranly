"""Shared parity fixtures: the Python engines must reproduce every `expected` value.

The same files are checked against the TypeScript engines by
web/src/domain/__tests__/parity.test.ts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from tests.parity.adapters import run

FIXTURES = Path(__file__).parent / "fixtures"


def _cases() -> list[Any]:
    cases = []
    for path in sorted(FIXTURES.glob("*.json")):
        for case in json.loads(path.read_text(encoding="utf-8")):
            cases.append(pytest.param(case, id=f"{path.stem}: {case['name']}"))
    return cases


@pytest.mark.parametrize("case", _cases())
def test_python_matches_fixture(case: dict[str, Any]) -> None:
    assert run(case["fn"], case["input"]) == case["expected"]


def test_fixtures_exist() -> None:
    assert len(_cases()) >= 30
