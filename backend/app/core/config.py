"""Application settings. Every value comes from environment variables (or backend/.env)."""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, PrivateAttr, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

logger = logging.getLogger("toranly.config")

MIN_SECRET_BYTES = 32
DEV_DEFAULT_RPM = 10
DEV_DEFAULT_TPM = 20000
# Groq's documented limits for openai/gpt-oss-120b include 8K tokens per minute.
GROQ_DEV_DEFAULT_TPM = 8000
# gpt-oss models reason before answering; leave room for that on top of the answer budget.
GROQ_REASONING_HEADROOM_TOKENS = 1024

ProviderName = Literal["xai", "groq"]


def _is_placeholder(value: str) -> bool:
    lowered = value.strip().lower()
    return lowered.startswith("your_") and lowered.endswith("_here")


@dataclass(frozen=True)
class ProviderSettings:
    """Resolved settings for one AI provider. `disabled_reason` is None when usable."""

    name: ProviderName
    api_key: SecretStr
    base_url: str
    model: str
    style: Literal["responses", "chat"]
    rpm: int
    tpm: int
    price_input_per_m: Decimal
    price_output_per_m: Decimal
    max_output_tokens: int
    disabled_reason: str | None


class ConfigError(RuntimeError):
    """Raised when the configuration is unsafe for the current APP_ENV."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://toranly:toranly@localhost:5432/toranly"

    session_secret: SecretStr = SecretStr("")
    ip_hash_salt: SecretStr = SecretStr("")

    xai_api_key: SecretStr = SecretStr("")
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4.3"
    xai_api_style: Literal["responses", "chat"] = "responses"
    xai_account_rpm: int | None = Field(default=None, gt=0)
    xai_account_tpm: int | None = Field(default=None, gt=0)
    xai_safety_factor: float = Field(default=0.8, gt=0, le=1)
    xai_price_input_per_m: Decimal = Field(default=Decimal("1.25"), ge=0)
    xai_price_output_per_m: Decimal = Field(default=Decimal("2.50"), ge=0)

    groq_api_key: SecretStr = SecretStr("")
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    groq_account_rpm: int | None = Field(default=None, gt=0)
    groq_account_tpm: int | None = Field(default=None, gt=0)
    groq_price_input_per_m: Decimal = Field(default=Decimal("0.15"), ge=0)
    groq_price_output_per_m: Decimal = Field(default=Decimal("0.60"), ge=0)

    ai_primary_provider: ProviderName = "xai"
    ai_fallback_provider: ProviderName | Literal["none"] = "groq"
    ai_failover_enabled: bool = True
    # Per provider call; XAI_TIMEOUT_SECONDS is still accepted (older .env files).
    ai_request_timeout_seconds: float = Field(
        default=30,
        gt=0,
        le=60,
        validation_alias=AliasChoices("ai_request_timeout_seconds", "xai_timeout_seconds"),
    )
    ai_max_retries_per_provider: int = Field(default=1, ge=0, le=2)
    ai_failover_cooldown_seconds: float = Field(default=60, ge=0, le=3600)

    ai_max_output_tokens: int = Field(default=2500, ge=100, le=16000)
    ai_max_concurrent: int = Field(default=3, ge=1, le=50)
    ai_limit_per_device_per_minute: int = Field(default=2, ge=1)
    ai_limit_per_device_per_day: int = Field(default=5, ge=1)
    ai_limit_per_ip_per_day: int = Field(default=20, ge=1)
    ai_global_daily_limit: int = Field(default=100, ge=1)
    ai_daily_spend_limit_usd: Decimal = Field(default=Decimal("2.00"), ge=0)

    api_limit_per_ip_per_minute: int = Field(default=60, ge=1)
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    max_body_bytes: int = Field(default=65536, ge=1024, le=1_048_576)

    # Exact public origin of the app, for example https://toranly.onrender.com. When empty the
    # Origin check compares against the request Host header.
    app_origin: str = ""
    # Peers whose X-Forwarded-For header is trusted (comma separated CIDRs). Empty = trust none.
    trusted_proxy_cidrs: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Number of Uvicorn worker processes; the in-process provider guard divides its budget by it.
    web_concurrency: int = Field(default=1, ge=1, le=16)
    static_dir: str = ""
    # APP_ENV=test only: answer AI requests from recorded fixtures (no network, no cost).
    ai_fake_provider: bool = False

    # Derived at validation time.
    ai_disabled_reason: str | None = None
    effective_rpm: int = 0
    effective_tpm: int = 0
    _providers: dict[str, ProviderSettings] = PrivateAttr(default_factory=dict)

    @field_validator("cors_origins", "trusted_proxy_cidrs", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [part.strip().rstrip("/") for part in value.split(",") if part.strip()]
        return value

    @field_validator(
        "xai_account_rpm", "xai_account_tpm", "groq_account_rpm", "groq_account_tpm", mode="before"
    )
    @classmethod
    def _empty_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("app_origin", mode="before")
    @classmethod
    def _strip_origin(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().rstrip("/")
        return value

    @model_validator(mode="after")
    def _validate_for_env(self) -> Settings:
        prod = self.app_env == "production"
        if self.ai_fake_provider and self.app_env != "test":
            raise ConfigError("AI_FAKE_PROVIDER is only allowed with APP_ENV=test.")
        if prod:
            for name in ("session_secret", "ip_hash_salt"):
                secret: SecretStr = getattr(self, name)
                if len(secret.get_secret_value().encode()) < MIN_SECRET_BYTES:
                    raise ConfigError(
                        f"{name.upper()} must be set to at least {MIN_SECRET_BYTES} bytes "
                        "in production."
                    )
            if any("*" in origin for origin in self.cors_origins):
                raise ConfigError("CORS_ORIGINS must not contain '*' in production.")
            if not self.app_origin:
                logger.warning(
                    "APP_ORIGIN is empty; the Origin check falls back to the Host header. "
                    "Set it to the exact public origin."
                )
            if not self.trusted_proxy_cidrs:
                logger.warning(
                    "TRUSTED_PROXY_CIDRS is empty; behind a proxy every user shares the proxy's "
                    "IP for rate limits and the AI per-IP budget."
                )
        else:
            # Development and tests may run without secrets; use ephemeral random values so
            # nothing predictable is ever used. Cookies stop verifying after a restart.
            if not self.session_secret.get_secret_value():
                logger.warning("SESSION_SECRET is empty; using an ephemeral random secret.")
                self.session_secret = SecretStr(secrets.token_urlsafe(64))
            if not self.ip_hash_salt.get_secret_value():
                logger.warning("IP_HASH_SALT is empty; using an ephemeral random salt.")
                self.ip_hash_salt = SecretStr(secrets.token_urlsafe(32))

        self._providers = {
            "xai": self._resolve_provider("xai", prod),
            "groq": self._resolve_provider("groq", prod),
        }
        xai = self.providers["xai"]
        self.effective_rpm, self.effective_tpm = xai.rpm, xai.tpm
        chain = [self.providers[name] for name in self.provider_chain]
        if any(p.disabled_reason is None for p in chain):
            self.ai_disabled_reason = None
        elif all(p.disabled_reason == "no_key" for p in chain):
            self.ai_disabled_reason = "no_key"
        else:
            self.ai_disabled_reason = "limits_not_configured"
        return self

    def _resolve_provider(self, name: ProviderName, prod: bool) -> ProviderSettings:
        key: SecretStr = getattr(self, f"{name}_api_key")
        if _is_placeholder(key.get_secret_value()):
            logger.warning(
                "%s_API_KEY is still the placeholder; treating it as empty.", name.upper()
            )
            key = SecretStr("")
        rpm: int | None = getattr(self, f"{name}_account_rpm")
        tpm: int | None = getattr(self, f"{name}_account_tpm")
        reason: str | None = None
        if not key.get_secret_value():
            reason = "no_key"
        elif rpm is None or tpm is None:
            label = f"{name.upper()}_ACCOUNT_RPM or {name.upper()}_ACCOUNT_TPM"
            if prod:
                reason = "limits_not_configured"
                logger.warning("%s is empty; %s is disabled in production.", label, name)
            else:
                default_tpm = GROQ_DEV_DEFAULT_TPM if name == "groq" else DEV_DEFAULT_TPM
                logger.warning(
                    "%s is empty; using conservative development defaults (RPM %s, TPM %s).",
                    label,
                    DEV_DEFAULT_RPM,
                    default_tpm,
                )
                rpm = rpm or DEV_DEFAULT_RPM
                tpm = tpm or default_tpm
        factor = self.xai_safety_factor
        groq = name == "groq"
        return ProviderSettings(
            name=name,
            api_key=key,
            base_url=self.groq_base_url if groq else self.xai_base_url,
            model=self.groq_model if groq else self.xai_model,
            style="chat" if groq else self.xai_api_style,
            rpm=max(1, int(rpm * factor)) if rpm else 0,
            tpm=max(1, int(tpm * factor)) if tpm else 0,
            price_input_per_m=self.groq_price_input_per_m if groq else self.xai_price_input_per_m,
            price_output_per_m=(
                self.groq_price_output_per_m if groq else self.xai_price_output_per_m
            ),
            max_output_tokens=self.ai_max_output_tokens
            + (GROQ_REASONING_HEADROOM_TOKENS if groq else 0),
            disabled_reason=reason,
        )

    @property
    def providers(self) -> dict[str, ProviderSettings]:
        return self._providers

    @property
    def provider_chain(self) -> list[ProviderName]:
        """Providers in the order they are tried: primary, then the fallback if enabled."""
        chain: list[ProviderName] = [self.ai_primary_provider]
        fallback = self.ai_fallback_provider
        if self.ai_failover_enabled and fallback != "none" and fallback not in chain:
            chain.append(fallback)
        return chain

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def ai_enabled(self) -> bool:
        return self.ai_disabled_reason is None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
