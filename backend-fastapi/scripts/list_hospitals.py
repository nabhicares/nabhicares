"""List hospitals so mock web clients know which X-Hospital-ID to send."""
import os
from pathlib import Path

import psycopg

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, _, value = line.partition("=")
    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    cur.execute("select id::text, name from hospital.hospitals order by name limit 10")
    rows = cur.fetchall()
    print("NONE" if not rows else "\n".join(f"{hid}\t{name}" for hid, name in rows))
