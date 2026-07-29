"""Create domain schemas.

Revision ID: 0001
Revises:
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMAS = (
    "auth",
    "hospital",
    "patient",
    "doctor",
    "appointment",
    "consultation",
    "prescription",
    "pharmacy",
    "inventory",
    "supplier",
    "billing",
    "payment",
    "notification",
    "audit",
    "analytics",
)


def upgrade() -> None:
    for schema in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')


def downgrade() -> None:
    for schema in reversed(SCHEMAS):
        op.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
