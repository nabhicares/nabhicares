"""Ensure a demo hospital exists so mock web/mobile clients have a tenant to scope to.

Uses DATABASE_MIGRATION_URL (avnadmin) because the runtime role is RLS-bound and
cannot invent a hospital before any session context exists.

    .venv/Scripts/python scripts/seed_demo_hospital.py
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import psycopg

# Stable id so web/mobile can bake it into NEXT_PUBLIC_HOSPITAL_ID / dart-define.
DEMO_HOSPITAL_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEMO_CODE = "DEMO"
DEMO_NAME = "Nabhi Care Demo Hospital"


def load_env() -> None:
    for line in Path(__file__).resolve().parent.parent.joinpath(".env").read_text(
        encoding="utf-8"
    ).splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> None:
    load_env()
    url = os.environ.get("DATABASE_MIGRATION_URL") or os.environ["DATABASE_URL"]
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into hospital.hospitals (id, code, name, timezone, status)
            values (%s, %s, %s, 'Asia/Kolkata', 'active')
            on conflict (code) do update set name = excluded.name
            returning id::text, code, name
            """,
            (str(DEMO_HOSPITAL_ID), DEMO_CODE, DEMO_NAME),
        )
        row = cur.fetchone()
        conn.commit()
        print(f"hospital id={row[0]} code={row[1]} name={row[2]}")


if __name__ == "__main__":
    main()
