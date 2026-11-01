"""AI usage counters: the only server tables in this phase.

Revision ID: 0001_ai_usage
Revises:
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_ai_usage"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_usage",
        sa.Column("device_hash", sa.String(64), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("minute_bucket", sa.SmallInteger(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("device_hash", "day", "minute_bucket", name="pk_ai_usage"),
        sa.CheckConstraint("minute_bucket BETWEEN 0 AND 1439", name="ck_ai_usage_minute"),
        sa.CheckConstraint("count >= 0", name="ck_ai_usage_count"),
    )
    op.create_index("ix_ai_usage_day", "ai_usage", ["day"])

    op.create_table(
        "ai_ip_usage",
        sa.Column("ip_hash", sa.String(64), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("ip_hash", "day", name="pk_ai_ip_usage"),
        sa.CheckConstraint("count >= 0", name="ck_ai_ip_usage_count"),
    )
    op.create_index("ix_ai_ip_usage_day", "ai_ip_usage", ["day"])

    op.create_table(
        "ai_global_usage",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("est_cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("day", name="pk_ai_global_usage"),
        sa.CheckConstraint("count >= 0", name="ck_ai_global_usage_count"),
        sa.CheckConstraint("est_cost_usd >= 0", name="ck_ai_global_usage_cost"),
    )


def downgrade() -> None:
    op.drop_table("ai_global_usage")
    op.drop_index("ix_ai_ip_usage_day", table_name="ai_ip_usage")
    op.drop_table("ai_ip_usage")
    op.drop_index("ix_ai_usage_day", table_name="ai_usage")
    op.drop_table("ai_usage")
