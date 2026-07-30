"""Verify the external services this API depends on are actually reachable.

Credentials are read from the environment (or .env), never hardcoded. Run this after
rotating secrets or before a deploy:

    .venv/Scripts/python scripts/check_services.py

Checks, in order of how often they break:
  * Aiven PostgreSQL reachable with the runtime role
  * the runtime role cannot bypass RLS (tenant isolation depends on it)
  * migrations have been applied
  * Aiven reachable with the admin role used by Alembic
  * Cloudinary credentials accepted
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> None:
    """Minimal .env loader; existing environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def redact(url: str) -> str:
    """Keep the shape of a connection string without leaking the password."""
    return re.sub(r"://([^:/@]+):[^@]*@", r"://\1:***@", url)


results: list[tuple[bool, str]] = []


def record(ok: bool, message: str) -> None:
    results.append((ok, message))
    print(f"{'PASS' if ok else 'FAIL'}  {message}")


def check_postgres(
    label: str,
    url: str,
    *,
    expect_no_bypass_rls: bool,
    check_migrations: bool,
) -> None:
    import psycopg

    try:
        # autocommit so one denied statement cannot poison the remaining checks.
        with psycopg.connect(url, connect_timeout=15, autocommit=True) as conn, conn.cursor() as cur:
            cur.execute("select current_user, current_database(), split_part(version(), ' ', 2)")
            user, database, version = cur.fetchone()
            record(True, f"{label}: connected as {user} to {database} (PostgreSQL {version})")

            cur.execute("select rolbypassrls from pg_roles where rolname = current_user")
            row = cur.fetchone()
            bypasses = bool(row and row[0])
            if expect_no_bypass_rls:
                record(
                    not bypasses,
                    f"{label}: row-level security is {'BYPASSED — tenants are not isolated' if bypasses else 'enforced'}",
                )

            # Only the migration role may read alembic_version; the runtime role is
            # deliberately denied it, so asking there would report a false failure.
            if check_migrations:
                cur.execute("select to_regclass('public.alembic_version') is not null")
                if cur.fetchone()[0]:
                    cur.execute("select version_num from alembic_version")
                    revisions = [r[0] for r in cur.fetchall()]
                    record(
                        bool(revisions),
                        f"{label}: migrations applied (revision {', '.join(revisions)})",
                    )
                else:
                    record(False, f"{label}: no alembic_version table — migrations have not run")

            cur.execute(
                """
                select table_schema, count(*)
                from information_schema.tables
                where table_type = 'BASE TABLE'
                  and table_schema not in ('pg_catalog', 'information_schema')
                group by table_schema
                order by table_schema
                """
            )
            rows = cur.fetchall()
            total = sum(count for _, count in rows)
            summary = ", ".join(f"{schema}={count}" for schema, count in rows) or "none"
            record(total > 0, f"{label}: {total} tables across {len(rows)} schemas ({summary})")
    except Exception as exc:  # noqa: BLE001 - report any failure rather than crash
        record(False, f"{label}: {type(exc).__name__}: {str(exc).strip()[:200]}")


def check_cloudinary(url: str) -> None:
    import cloudinary
    import cloudinary.api

    try:
        cloudinary.config(cloudinary_url=url)
        cloud_name = cloudinary.config().cloud_name
        response = cloudinary.api.ping()
        record(
            response.get("status") == "ok",
            f"Cloudinary: credentials accepted for cloud '{cloud_name}' (ping {response.get('status')})",
        )
        usage = cloudinary.api.usage()
        record(
            True,
            f"Cloudinary: plan '{usage.get('plan')}', "
            f"{usage.get('resources', 0)} stored assets",
        )
    except Exception as exc:  # noqa: BLE001
        record(False, f"Cloudinary: {type(exc).__name__}: {str(exc).strip()[:200]}")


def main() -> int:
    load_env(ROOT / ".env")

    runtime_url = os.environ.get("DATABASE_URL")
    migration_url = os.environ.get("DATABASE_MIGRATION_URL")
    cloudinary_url = os.environ.get("CLOUDINARY_URL")

    if runtime_url:
        print(f"\nDATABASE_URL           {redact(runtime_url)}")
    if migration_url:
        print(f"DATABASE_MIGRATION_URL {redact(migration_url)}")
    if cloudinary_url:
        print(f"CLOUDINARY_URL         {redact(cloudinary_url)}\n")

    if runtime_url:
        check_postgres(
            "Aiven runtime", runtime_url, expect_no_bypass_rls=True, check_migrations=False
        )
    else:
        record(False, "DATABASE_URL is not set")

    if migration_url:
        check_postgres(
            "Aiven admin", migration_url, expect_no_bypass_rls=False, check_migrations=True
        )
    else:
        record(False, "DATABASE_MIGRATION_URL is not set")

    if cloudinary_url:
        check_cloudinary(cloudinary_url)
    else:
        record(False, "CLOUDINARY_URL is not set")

    failures = [message for ok, message in results if not ok]
    print()
    if failures:
        print(f"{len(failures)} check(s) failed:")
        for message in failures:
            print(f"  - {message}")
        return 1
    print(f"All {len(results)} checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
