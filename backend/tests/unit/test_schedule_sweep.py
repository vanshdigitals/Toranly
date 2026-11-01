"""The sweep-line overlap check returns exactly what a pairwise scan returns, in order."""

from __future__ import annotations

from dataclasses import dataclass

from hypothesis import given
from hypothesis import strategies as st

from app.domain.schedule import detect_overlaps, to_minutes


@dataclass(frozen=True)
class Item:
    id: str
    function_id: str
    start_time: str
    duration_min: int


def pairwise(items: list[Item]) -> list[tuple[str, str, str]]:
    result = []
    for i, a in enumerate(items):
        for b in items[i + 1 :]:
            if a.function_id != b.function_id:
                continue
            sa, sb = to_minutes(a.start_time), to_minutes(b.start_time)
            if sa < sb + b.duration_min and sb < sa + a.duration_min:
                result.append((a.id, b.id, a.function_id))
    return result


items_strategy = st.lists(
    st.tuples(
        st.sampled_from(["f1", "f2"]),
        st.integers(min_value=0, max_value=23 * 60),
        st.integers(min_value=1, max_value=240),
    ),
    max_size=25,
)


@given(items_strategy)
def test_sweep_matches_pairwise(raw: list[tuple[str, int, int]]) -> None:
    items = [
        Item(f"i{n}", fn, f"{start // 60:02d}:{start % 60:02d}", dur)
        for n, (fn, start, dur) in enumerate(raw)
    ]
    got = [(o.item_a_id, o.item_b_id, o.function_id) for o in detect_overlaps(items)]
    # Grouped by function in first-seen order, then input order within each function.
    functions = list(dict.fromkeys(it.function_id for it in items))
    expected = [p for fn in functions for p in pairwise(items) if p[2] == fn]
    assert got == expected
