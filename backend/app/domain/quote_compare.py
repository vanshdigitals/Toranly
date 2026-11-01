"""Quote normalisation per guest / plate and cheapest flag."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.domain.money import round_half_up_div


class QuoteLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def vendor_id(self) -> str: ...
    @property
    def amount_paise(self) -> int: ...
    @property
    def unit(self) -> str: ...
    @property
    def units(self) -> int | None: ...
    @property
    def inclusions(self) -> Sequence[str]: ...
    @property
    def valid_until(self) -> date | None: ...


@dataclass(frozen=True)
class NormalizedQuote:
    id: str
    vendor_id: str
    raw_amount_paise: int
    unit: str
    units: int | None
    total_paise: int
    per_guest_paise: int
    missing_units: bool
    expired: bool
    is_cheapest: bool


def normalize_quote(quote: QuoteLike, guest_count: int) -> tuple[int, int]:
    """(total_paise, per_guest_paise). Per-plate/per-guest quotes without `units` fall back to
    the guest count, as the web app does; `missing_units` flags that case for the UI."""
    guests = max(1, guest_count)
    total = quote.amount_paise
    if quote.unit in ("per_plate", "per_guest"):
        multiplier = quote.units if quote.units is not None and quote.units > 0 else guests
        total = quote.amount_paise * multiplier
    return total, round_half_up_div(total, guests)


def compare_quotes(
    quotes: Sequence[QuoteLike], guest_count: int, today: date | None = None
) -> list[NormalizedQuote]:
    rows: list[NormalizedQuote] = []
    for q in quotes:
        total, per_guest = normalize_quote(q, guest_count)
        rows.append(
            NormalizedQuote(
                id=q.id,
                vendor_id=q.vendor_id,
                raw_amount_paise=q.amount_paise,
                unit=q.unit,
                units=q.units,
                total_paise=total,
                per_guest_paise=per_guest,
                missing_units=q.unit != "total" and not (q.units and q.units > 0),
                expired=bool(today and q.valid_until and q.valid_until < today),
                is_cheapest=False,
            )
        )
    if not rows:
        return rows
    lowest = min(r.total_paise for r in rows)
    return [NormalizedQuote(**{**r.__dict__, "is_cheapest": r.total_paise == lowest}) for r in rows]
