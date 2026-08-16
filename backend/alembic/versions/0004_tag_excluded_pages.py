"""Add tags.excluded_pages, seed defaults for known tag names

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-16

Adds a per-tag `excluded_pages` array column so any tag can be scoped
(Settings > Tags) to hide its transactions from dashboard, analytics, and/or
budgets independently -- replacing the old hardcoded "look up the tag
literally named 'Exclude from Analytics'" logic in dashboard_service,
analytics_service, budget_plan_service and alert_service (see
app/crud/tag_crud.get_excluded_transaction_ids).

Data seed, scoped per user and only touching rows that have no scope set yet
(so a user who already configured this via the UI before this migration ran
isn't clobbered):

1. A tag named exactly "Exclude from Analytics" defaults to
   ["dashboard", "analytics"] -- hidden from charts, but still counts
   against budgets (a spend hidden from charts still consumed the category's
   limit).
2. A tag named exactly "Capital Transfers" defaults to
   ["dashboard", "analytics", "budgets"] -- hidden everywhere, since moving
   money to your own other account isn't real category spend at all.

Both are just sensible starting points for these two conventional names;
fully editable afterwards from Settings > Tags.
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tags",
        sa.Column("excluded_pages", sa.ARRAY(sa.String()), nullable=False, server_default="{}"),
    )

    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE tags SET excluded_pages = ARRAY['dashboard', 'analytics']
        WHERE name = 'Exclude from Analytics' AND (excluded_pages IS NULL OR excluded_pages = '{}')
    """))
    conn.execute(sa.text("""
        UPDATE tags SET excluded_pages = ARRAY['dashboard', 'analytics', 'budgets']
        WHERE name = 'Capital Transfers' AND (excluded_pages IS NULL OR excluded_pages = '{}')
    """))


def downgrade() -> None:
    op.drop_column("tags", "excluded_pages")
