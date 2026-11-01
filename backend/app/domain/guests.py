"""Diet totals and coverage of diet groups by menu ideas."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

# Web app keys (camelCase) in display order.
DIET_KEYS: tuple[str, ...] = ("veg", "nonVeg", "jain", "eggetarian", "vegan")


@dataclass(frozen=True)
class DietCounts:
    veg: int = 0
    non_veg: int = 0
    jain: int = 0
    eggetarian: int = 0
    vegan: int = 0

    def by_key(self) -> dict[str, int]:
        return {
            "veg": self.veg,
            "nonVeg": self.non_veg,
            "jain": self.jain,
            "eggetarian": self.eggetarian,
            "vegan": self.vegan,
        }

    @property
    def total(self) -> int:
        return self.veg + self.non_veg + self.jain + self.eggetarian + self.vegan


class IdeaLike(Protocol):
    @property
    def kind(self) -> str: ...
    @property
    def diet_tags(self) -> Sequence[str]: ...


@dataclass(frozen=True)
class DietValidation:
    valid: bool
    sum: int
    expected_total: int
    difference: int


def validate_diet_counts(expected_total: int, counts: DietCounts) -> DietValidation:
    """`valid` means the diet groups add up exactly to the guest total (web app rule).
    The API's validate endpoint additionally treats sum > total as an error and
    sum < total as a warning (DATABASE.md / API.md E-51)."""
    diff = counts.total - expected_total
    return DietValidation(diff == 0, counts.total, expected_total, diff)


# Tags that cover each diet group. The web app accepts the first set of spellings; this
# engine also accepts "non_veg", the DietGroup value used by AI menu items (AI_SCHEMAS.md).
_COVERING_TAGS: dict[str, frozenset[str]] = {
    "veg": frozenset({"veg", "-veg"}),
    "nonVeg": frozenset({"nonveg", "non-veg", "non_veg"}),
    "jain": frozenset({"jain"}),
    "eggetarian": frozenset({"eggetarian"}),
    "vegan": frozenset({"vegan", "-vegan"}),
}


@dataclass(frozen=True)
class DietCoverage:
    covered: list[str]
    uncovered: list[str]
    fully_covered: bool


def diet_coverage(counts: DietCounts, ideas: Sequence[IdeaLike]) -> DietCoverage:
    tags = {tag.lower().strip() for idea in ideas if idea.kind == "menu" for tag in idea.diet_tags}
    covered: list[str] = []
    uncovered: list[str] = []
    for key, count in counts.by_key().items():
        if count <= 0:
            continue
        (covered if tags & _COVERING_TAGS[key] else uncovered).append(key)
    return DietCoverage(covered, uncovered, not uncovered)
