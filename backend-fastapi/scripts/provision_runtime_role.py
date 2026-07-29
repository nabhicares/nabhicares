"""Provision the non-owner PostgreSQL role used by the API runtime."""

import os
import secrets
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

import psycopg
from psycopg import sql

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
ROLE = "nabhi_app"


def main() -> None:
    admin_url = os.environ["ADMIN_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    password = os.getenv("APP_DATABASE_PASSWORD") or secrets.token_urlsafe(36)

    with psycopg.connect(admin_url, autocommit=True) as connection:
        role_exists = connection.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s", (ROLE,)
        ).fetchone()
        statement = (
            sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {} NOBYPASSRLS")
            if role_exists
            else sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD {} NOBYPASSRLS")
        )
        connection.execute(statement.format(sql.Identifier(ROLE), sql.Literal(password)))
        connection.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                sql.Identifier(connection.info.dbname), sql.Identifier(ROLE)
            )
        )
        for schema in SCHEMAS:
            identifiers = (sql.Identifier(schema), sql.Identifier(ROLE))
            connection.execute(
                sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(*identifiers)
            )
            connection.execute(
                sql.SQL(
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {} TO {}"
                ).format(*identifiers)
            )
            connection.execute(
                sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA {} TO {}").format(
                    *identifiers
                )
            )
            connection.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES FOR ROLE avnadmin IN SCHEMA {} "
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}"
                ).format(*identifiers)
            )
            connection.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES FOR ROLE avnadmin IN SCHEMA {} "
                    "GRANT USAGE, SELECT ON SEQUENCES TO {}"
                ).format(*identifiers)
            )

    parts = urlsplit(admin_url)
    host = parts.hostname or ""
    if parts.port:
        host += f":{parts.port}"
    runtime_url = urlunsplit(
        (
            parts.scheme,
            f"{ROLE}:{quote(password, safe='')}@{host}",
            parts.path,
            parts.query,
            parts.fragment,
        )
    )
    output = Path(os.getenv("OUTPUT_ENV", ".env.database"))
    output.write_text(
        f"DATABASE_URL={runtime_url}\nDATABASE_MIGRATION_URL={admin_url}\n",
        encoding="utf-8",
    )
    print(f"Runtime and migration URLs written to {output}")


if __name__ == "__main__":
    main()
