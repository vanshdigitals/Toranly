"""Contract registry: allowed item kinds, per-contract output envelope and xAI JSON Schema."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Literal, Union, cast

from pydantic import BaseModel, ConfigDict, Field, create_model

from app.ai.contracts.models import (
    CONTRACT_VERSION,
    T200,
    T300,
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

ContractName = Literal[
    "plan.generate",
    "plan.revise",
    "budget.suggest",
    "timeline.suggest",
    "theme.suggest",
    "menu.suggest",
    "vendors.categories",
    "budget.savings",
    "schedule.draft",
]

_FULL: tuple[type[BaseModel], ...] = (
    BudgetShare,
    TaskItem,
    ThemeIdea,
    DecorIdea,
    MenuItem,
    VendorCategory,
)

_KINDS: dict[str, tuple[type[BaseModel], ...]] = {
    "plan.generate": _FULL,
    "plan.revise": _FULL,
    "budget.suggest": (BudgetShare,),
    "timeline.suggest": (TaskItem,),
    "theme.suggest": (ThemeIdea, DecorIdea),
    "menu.suggest": (MenuItem,),
    "vendors.categories": (VendorCategory,),
    "budget.savings": (SavingIdea,),
    "schedule.draft": (ScheduleItem,),
}

FALLBACK_CONTRACTS = frozenset({"plan.generate", "timeline.suggest"})


@dataclass(frozen=True)
class Contract:
    name: str
    item_models: tuple[type[BaseModel], ...]
    envelope: type[BaseModel]

    @property
    def schema_name(self) -> str:
        return self.name.replace(".", "_")

    @property
    def kinds(self) -> frozenset[str]:
        return frozenset(
            cast(str, m.model_fields["kind"].annotation.__args__[0])  # type: ignore[union-attr]
            for m in self.item_models
        )

    @property
    def has_fallback(self) -> bool:
        return self.name in FALLBACK_CONTRACTS


def _envelope(name: str, models: tuple[type[BaseModel], ...]) -> type[BaseModel]:
    item: Any = (
        models[0] if len(models) == 1 else Annotated[Union[models], Field(discriminator="kind")]  # noqa: UP007
    )
    version: Any = Literal[CONTRACT_VERSION]
    return create_model(
        "Envelope_" + name.replace(".", "_"),
        __config__=ConfigDict(extra="forbid"),
        contract_version=(version, ...),
        items=(list[item], Field(max_length=60)),
        assumptions=(list[T200], Field(max_length=10)),
        warnings=(list[T200], Field(max_length=10)),
        refusal=(T300 | None, ...),
    )


CONTRACTS: dict[str, Contract] = {
    name: Contract(name, models, _envelope(name, models)) for name, models in _KINDS.items()
}


def get_contract(name: str) -> Contract:
    return CONTRACTS[name]


def _to_xai_subset(node: Any) -> Any:
    """Adapt Pydantic's JSON Schema to the subset xAI documents for structured outputs.

    `oneOf` becomes `anyOf` (xAI treats them the same), the OpenAPI-only `discriminator`
    keyword is removed, and titles are dropped to save tokens.
    """
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key in ("discriminator", "title"):
                continue
            if key in ("properties", "$defs"):
                # Mappings of names to schemas: keep every name (a field may be called "title").
                out[key] = {name: _to_xai_subset(sub) for name, sub in value.items()}
                continue
            out["anyOf" if key == "oneOf" else key] = _to_xai_subset(value)
        if out.get("type") == "object" and "properties" in out:
            out.setdefault("additionalProperties", False)
        return out
    if isinstance(node, list):
        return [_to_xai_subset(v) for v in node]
    return node


def xai_schema(contract: Contract) -> dict[str, Any]:
    result: dict[str, Any] = _to_xai_subset(contract.envelope.model_json_schema())
    return result


__all__ = [
    "CONTRACTS",
    "CONTRACT_VERSION",
    "FALLBACK_CONTRACTS",
    "Contract",
    "ContractName",
    "PlanContext",
    "get_contract",
    "xai_schema",
]
