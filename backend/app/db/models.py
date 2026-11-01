"""The only server tables in this phase: AI usage counters. No event data is stored."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import BigInteger, Date, Index, Integer, Numeric, SmallInteger, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiUsage(Base):
    """Per device, per UTC day and minute. device_hash is SHA-256 of the random device id."""

    __tablename__ = "ai_usage"

    device_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    minute_bucket: Mapped[int] = mapped_column(SmallInteger, primary_key=True)  # 0..1439 UTC
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    __table_args__ = (Index("ix_ai_usage_day", "day"),)


class AiIpUsage(Base):
    """Per salted IP hash, per UTC day."""

    __tablename__ = "ai_ip_usage"

    ip_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (Index("ix_ai_ip_usage_day", "day"),)


class AiGlobalUsage(Base):
    """One row per UTC day: request count, tokens and estimated spend (including reservations)."""

    __tablename__ = "ai_global_usage"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    est_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 6), nullable=False, default=Decimal(0)
    )
