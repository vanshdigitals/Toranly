"""Money in integer paise. No floating point arithmetic on amounts (NFR-04)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction


@dataclass(frozen=True)
class Share:
    key: str
    share_percent: Decimal | int | float | str


@dataclass(frozen=True)
class Allocation:
    key: str
    share_percent: Decimal
    allocated_paise: int


def _exact(value: Decimal | int | float | str) -> Fraction:
    # str() first so 33.33 means exactly 33.33, not the nearest binary float.
    return Fraction(Decimal(str(value)))


def split_largest_remainder(total_paise: int, shares: list[Share]) -> list[Allocation]:
    """Largest-remainder (Hamilton) split of `total_paise` by percentage shares.

    Each share gets floor(total * pct / 100); the leftover paise go one each to the largest
    fractional remainders, ties broken by position in the list. When the shares sum to 100
    the allocations sum exactly to the total. Mirrors web/src/domain/money.ts.
    """
    if not shares:
        return []
    if total_paise <= 0:
        return [Allocation(s.key, Decimal(str(s.share_percent)), 0) for s in shares]

    floors: list[int] = []
    remainders: list[Fraction] = []
    for share in shares:
        exact = Fraction(total_paise) * _exact(share.share_percent) / 100
        floored = exact.numerator // exact.denominator
        floors.append(floored)
        remainders.append(exact - floored)

    leftover = total_paise - sum(floors)
    order = sorted(range(len(shares)), key=lambda i: (-remainders[i], i))
    bonus = set(order[: max(0, min(leftover, len(shares)))])
    return [
        Allocation(s.key, Decimal(str(s.share_percent)), floors[i] + (1 if i in bonus else 0))
        for i, s in enumerate(shares)
    ]


def round_half_up_div(numerator: int, denominator: int) -> int:
    """floor(n / d + 1/2): the same rounding as JavaScript Math.round, in integers."""
    if denominator <= 0:
        raise ValueError("denominator must be positive")
    return (2 * numerator + denominator) // (2 * denominator)


def paise_to_rupees_floor(paise: int) -> int:
    return paise // 100


def rescale_to_basis_points(weights: list[Decimal]) -> list[int]:
    """Rescale non-negative weights to integer basis points summing to exactly 10000."""
    exact = [Fraction(w) for w in weights]
    total = sum(exact, Fraction(0))
    if total <= 0:
        return [0 for _ in weights]
    scaled = [w * 10000 / total for w in exact]
    floors = [s.numerator // s.denominator for s in scaled]
    leftover = 10000 - sum(floors)
    order = sorted(range(len(scaled)), key=lambda i: (-(scaled[i] - floors[i]), i))
    for i in order[:leftover]:
        floors[i] += 1
    return floors
