"""Enforce hospital tenant isolation with PostgreSQL RLS.

Revision ID: 0003
Revises: f0d4bb0b681b
"""

from alembic import op

revision = "0003"
down_revision = "f0d4bb0b681b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE row record;
        BEGIN
          FOR row IN
            SELECT table_schema, table_name
            FROM information_schema.columns
            WHERE column_name = 'hospital_id'
              AND table_schema IN (
                'auth', 'hospital', 'patient', 'doctor', 'appointment',
                'consultation', 'prescription', 'pharmacy', 'inventory',
                'supplier', 'billing', 'payment', 'notification', 'audit',
                'analytics'
              )
          LOOP
            EXECUTE format(
              'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
              row.table_schema, row.table_name
            );
            EXECUTE format(
              'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
              row.table_schema, row.table_name
            );
            EXECUTE format(
              'CREATE POLICY tenant_isolation ON %I.%I '
              'USING ('
                'current_setting(''app.is_super_admin'', true) = ''true'' OR '
                'hospital_id::text = nullif(current_setting(''app.hospital_id'', true), '''')'
              ') '
              'WITH CHECK ('
                'current_setting(''app.is_super_admin'', true) = ''true'' OR '
                'hospital_id::text = nullif(current_setting(''app.hospital_id'', true), '''')'
              ')',
              row.table_schema, row.table_name
            );
          END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE row record;
        BEGIN
          FOR row IN
            SELECT schemaname, tablename
            FROM pg_policies
            WHERE policyname = 'tenant_isolation'
          LOOP
            EXECUTE format(
              'DROP POLICY tenant_isolation ON %I.%I',
              row.schemaname, row.tablename
            );
            EXECUTE format(
              'ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY',
              row.schemaname, row.tablename
            );
          END LOOP;
        END $$;
        """
    )
