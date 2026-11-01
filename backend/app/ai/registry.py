"""Builds the provider failover chain from settings."""

from __future__ import annotations

import logging
from collections.abc import Mapping

from app.ai.orchestrator import ProviderSlot
from app.ai.provider import Provider
from app.ai.usage import Prices, ProviderGuard
from app.core.config import ProviderSettings, Settings

logger = logging.getLogger("toranly.ai")


def build_provider(cfg: ProviderSettings) -> Provider:
    key = cfg.api_key.get_secret_value()
    if cfg.name == "groq":
        from app.ai.groq_client import GroqProvider

        return GroqProvider(api_key=key, base_url=cfg.base_url, model=cfg.model)
    from app.ai.xai_client import XaiProvider

    return XaiProvider(api_key=key, base_url=cfg.base_url, model=cfg.model, style=cfg.style)


def build_slots(
    settings: Settings, overrides: Mapping[str, Provider] | None = None
) -> list[ProviderSlot]:
    """Usable providers in chain order. `overrides` replaces the real client (tests)."""
    overrides = overrides or {}
    slots: list[ProviderSlot] = []
    for name in settings.provider_chain:
        cfg = settings.providers[name]
        if cfg.disabled_reason is not None:
            logger.info(
                "ai_provider_unavailable",
                extra={"provider": name, "error_code": cfg.disabled_reason},
            )
            continue
        slots.append(
            ProviderSlot(
                name=name,
                model=cfg.model,
                provider=overrides.get(name) or build_provider(cfg),
                guard=ProviderGuard(cfg.rpm, cfg.tpm, settings.web_concurrency),
                prices=Prices(cfg.price_input_per_m, cfg.price_output_per_m),
                max_output_tokens=cfg.max_output_tokens,
            )
        )
    return slots
