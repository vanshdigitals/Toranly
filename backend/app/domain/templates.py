"""Per event type templates: budget shares, functions and starter tasks.

Copied from web/src/domain/templates.ts (CANONICAL_TEMPLATES). The parity fixtures in
tests/parity check both copies give identical results; change them together.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from app.domain.money import Share, split_largest_remainder
from app.domain.timeline_engine import due_date_from_offset

EventType = Literal["wedding", "engagement", "birthday", "anniversary", "community", "family"]
EVENT_TYPES: tuple[EventType, ...] = (
    "wedding",
    "engagement",
    "birthday",
    "anniversary",
    "community",
    "family",
)


@dataclass(frozen=True)
class TemplateShare:
    key: str
    label: str
    share_percent: int
    position: int


@dataclass(frozen=True)
class TemplateFunction:
    name: str
    offset_days: int
    start_time: str
    end_time: str


@dataclass(frozen=True)
class TemplateTask:
    title: str
    category_key: str
    offset_days: int
    is_milestone: bool
    depends_on_indexes: tuple[int, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Template:
    shares: tuple[TemplateShare, ...]
    functions: tuple[TemplateFunction, ...]
    tasks: tuple[TemplateTask, ...]


TEMPLATES: dict[EventType, Template] = {
    "wedding": Template(
        shares=(
            TemplateShare("venue", "Venue & Stays", 28, 1),
            TemplateShare("catering", "Catering & Dining", 30, 2),
            TemplateShare("decor", "Decor & Mandap", 14, 3),
            TemplateShare("attire", "Attire & Jewellery", 10, 4),
            TemplateShare("photo", "Photography & Film", 8, 5),
            TemplateShare("entertainment", "Music & Sangeet", 4, 6),
            TemplateShare("invitations", "Invitations & Favours", 3, 7),
            TemplateShare("contingency", "Contingency Fund", 3, 8),
        ),
        functions=(
            TemplateFunction("Mehendi & High Tea", 2, "16:00", "20:30"),
            TemplateFunction("Sangeet & Cocktail", 1, "19:30", "23:45"),
            TemplateFunction("Wedding & Pheras", 0, "10:00", "15:00"),
            TemplateFunction("Evening Reception", 0, "19:30", "23:30"),
        ),
        tasks=(
            TemplateTask(
                "Shortlist and visit shortlisted venues",
                "venue",
                120,
                False,
            ),
            TemplateTask(
                "Lock in main venue & dates",
                "venue",
                110,
                True,
                (0,),
            ),
            TemplateTask(
                "Shortlist candid photographer & videographer",
                "photo",
                95,
                False,
            ),
            TemplateTask(
                "Book photography team with deposit",
                "photo",
                85,
                True,
                (2,),
            ),
            TemplateTask(
                "Finalise caterer tasting and menu items",
                "catering",
                70,
                True,
            ),
            TemplateTask(
                "Send invitations with RSVP links",
                "invitations",
                60,
                True,
            ),
            TemplateTask(
                "Select bridal attire and schedule first fitting",
                "attire",
                45,
                False,
            ),
            TemplateTask(
                "Finalise decor stage layout and floral palettes",
                "decor",
                30,
                False,
            ),
            TemplateTask(
                "Confirm sangeet playlist and sound rehearsal",
                "entertainment",
                14,
                False,
            ),
            TemplateTask(
                "Final walkthrough with day-of coordinator",
                "venue",
                3,
                True,
            ),
        ),
    ),
    "engagement": Template(
        shares=(
            TemplateShare("venue", "Venue & Hospitality", 32, 1),
            TemplateShare("catering", "Food & Bar", 35, 2),
            TemplateShare("decor", "Stage & Ambient Decor", 15, 3),
            TemplateShare("attire", "Attire & Rings", 10, 4),
            TemplateShare("contingency", "Contingency Reserve", 8, 5),
        ),
        functions=(TemplateFunction("Ring Ceremony & Dinner", 0, "18:30", "23:00"),),
        tasks=(
            TemplateTask(
                "Select engagement venue and banquet hall",
                "venue",
                60,
                True,
            ),
            TemplateTask(
                "Choose rings and celebratory attire",
                "attire",
                45,
                False,
            ),
            TemplateTask(
                "Book candid photographer for ceremony",
                "photo",
                35,
                False,
            ),
            TemplateTask(
                "Send digital invitations and collect RSVPs",
                "invitations",
                28,
                True,
            ),
            TemplateTask(
                "Confirm menu tastings and live food stations",
                "catering",
                12,
                True,
            ),
        ),
    ),
    "birthday": Template(
        shares=(
            TemplateShare("venue", "Party Venue", 25, 1),
            TemplateShare("catering", "Catering & Beverages", 35, 2),
            TemplateShare("cake", "Custom Cake & Treats", 12, 3),
            TemplateShare("decor", "Theme Decor & Balloons", 10, 4),
            TemplateShare("entertainment", "Host, Games & Music", 10, 5),
            TemplateShare("gifts", "Return Favours", 5, 6),
            TemplateShare("contingency", "Contingency Reserve", 3, 7),
        ),
        functions=(TemplateFunction("Birthday Celebration & Party", 0, "17:00", "21:30"),),
        tasks=(
            TemplateTask(
                "Pick party theme and reserve venue",
                "venue",
                30,
                True,
            ),
            TemplateTask(
                "Order custom birthday cake and flavour tasting",
                "cake",
                18,
                False,
            ),
            TemplateTask(
                "Send party invitations with RSVP deadline",
                "invitations",
                16,
                True,
            ),
            TemplateTask(
                "Book entertainer / games host / DJ",
                "entertainment",
                12,
                False,
            ),
            TemplateTask(
                "Purchase party favours and return gifts",
                "gifts",
                7,
                False,
            ),
            TemplateTask(
                "Confirm final headcount with catering",
                "catering",
                3,
                True,
            ),
        ),
    ),
    "anniversary": Template(
        shares=(
            TemplateShare("venue", "Celebration Banquet", 45, 1),
            TemplateShare("decor", "Floral & Ambient Styling", 20, 2),
            TemplateShare("photo", "Photography & Album", 15, 3),
            TemplateShare("gifts", "Mementos & Gifts", 10, 4),
            TemplateShare("contingency", "Contingency Reserve", 10, 5),
        ),
        functions=(TemplateFunction("Anniversary Dinner & Toast", 0, "19:00", "23:00"),),
        tasks=(
            TemplateTask(
                "Reserve private dining space or banquet",
                "venue",
                35,
                True,
            ),
            TemplateTask(
                "Curate nostalgic photo presentation / video",
                "photo",
                20,
                False,
            ),
            TemplateTask(
                "Send invitations to family and close friends",
                "invitations",
                18,
                True,
            ),
            TemplateTask(
                "Confirm special anniversary cake and floral centerpiece",
                "decor",
                8,
                False,
            ),
        ),
    ),
    "community": Template(
        shares=(
            TemplateShare("venue", "Grounds & Sound Infrastructure", 35, 1),
            TemplateShare("catering", "Community Feasts & Refreshments", 30, 2),
            TemplateShare("decor", "Marquee, Seating & Lighting", 15, 3),
            TemplateShare("permits", "Permits, Security & Sanitation", 12, 4),
            TemplateShare("contingency", "Contingency Fund", 8, 5),
        ),
        functions=(TemplateFunction("Community Festival / Utsav", 0, "09:00", "21:00"),),
        tasks=(
            TemplateTask(
                "Obtain venue clearance and local municipality permits",
                "permits",
                45,
                True,
            ),
            TemplateTask(
                "Arrange sound equipment, stage lighting, and generator backup",
                "venue",
                30,
                False,
            ),
            TemplateTask(
                "Finalise community dining and prasadam preparation plan",
                "catering",
                20,
                False,
            ),
            TemplateTask(
                "Organise volunteer coordination briefing",
                "permits",
                10,
                True,
            ),
            TemplateTask(
                "Stage soundcheck and seating setup review",
                "venue",
                2,
                False,
            ),
        ),
    ),
    "family": Template(
        shares=(
            TemplateShare("catering", "Feast & Traditional Delicacies", 40, 1),
            TemplateShare("venue", "Venue & Accommodation", 25, 2),
            TemplateShare("decor", "Traditional Decor & Lighting", 15, 3),
            TemplateShare("gifts", "Family Mementos & Shagun", 10, 4),
            TemplateShare("contingency", "Contingency Reserve", 10, 5),
        ),
        functions=(TemplateFunction("Family Gathering & Festive Meal", 0, "11:30", "16:30"),),
        tasks=(
            TemplateTask(
                "Confirm gathering venue or home preparation",
                "venue",
                40,
                True,
            ),
            TemplateTask(
                "Coordinate family travel logistics and stay",
                "venue",
                25,
                False,
            ),
            TemplateTask(
                "Curate multi-generation family feast menu",
                "catering",
                20,
                False,
            ),
            TemplateTask(
                "Order festive toran and flower garlands",
                "decor",
                6,
                False,
            ),
            TemplateTask(
                "Prepare welcome gifts and shagun hampers",
                "gifts",
                3,
                True,
            ),
        ),
    ),
}


@dataclass(frozen=True)
class TemplateCategory:
    key: str
    label: str
    share_percent: int
    allocated_paise: int
    position: int


@dataclass(frozen=True)
class StarterTask:
    position: int
    title: str
    category_key: str
    offset_days: int
    due_date: date | None
    is_milestone: bool
    depends_on_positions: tuple[int, ...]


@dataclass(frozen=True)
class TemplateResult:
    categories: list[TemplateCategory]
    tasks: list[StarterTask]


def build_template(
    event_type: EventType, budget_total_paise: int | None, event_date: date | None
) -> TemplateResult:
    """Budget categories (largest-remainder split) and starter tasks with due dates.

    A null budget gives zero allocations (the shares are still returned). A null date gives
    tasks without due dates. Positions are 1-based; dependencies refer to task positions.
    """
    tpl = TEMPLATES[event_type]
    allocations = split_largest_remainder(
        budget_total_paise or 0, [Share(s.key, s.share_percent) for s in tpl.shares]
    )
    categories = [
        TemplateCategory(s.key, s.label, s.share_percent, a.allocated_paise, i + 1)
        for i, (s, a) in enumerate(zip(tpl.shares, allocations, strict=True))
    ]
    tasks = [
        StarterTask(
            position=i + 1,
            title=t.title,
            category_key=t.category_key,
            offset_days=t.offset_days,
            due_date=due_date_from_offset(event_date, t.offset_days) if event_date else None,
            is_milestone=t.is_milestone,
            depends_on_positions=tuple(d + 1 for d in t.depends_on_indexes),
        )
        for i, t in enumerate(tpl.tasks)
    ]
    return TemplateResult(categories, tasks)
