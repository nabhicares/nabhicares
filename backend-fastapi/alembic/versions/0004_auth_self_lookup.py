"""Let a request read its own auth.users row before its tenant is known.

tenant_isolation filters auth.users by app.hospital_id, but the tenant is what that very
row supplies: with only that policy a real Firebase token can never be resolved, because
the lookup that would set the tenant is hidden by the tenant filter. This adds a second
permissive policy matching on app.firebase_uid, which the API sets from the verified token.

Revision ID: 0004
Revises: 772358151d62
"""

from alembic import op

revision = "0004"
down_revision = "772358151d62"
branch_labels = None
depends_on = None

PREDICATE = "firebase_uid = nullif(current_setting('app.firebase_uid', true), '')"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE POLICY self_lookup ON auth.users
          USING ({PREDICATE})
          WITH CHECK ({PREDICATE})
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY self_lookup ON auth.users")
