"""Call every endpoint the web portal calls, as the role that calls it.

Imports through api/index.py — the module named in [tool.vercel] entrypoint — so this
exercises the same object the deployment loads, not just app.main. Mock auth is forced
on locally; the deployment only honours it when ALLOW_MOCK_AUTH is set there too.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

WEB_ORIGIN = "https://cares.nabhilabs.com"
HOSPITAL = "11111111-1111-1111-1111-111111111111"

# page, role, path, fields the page's table reads
CALLS = [
    ("reception/patients", "receptionist", "/patients?limit=50", ("name", "phone", "dateOfBirth")),
    (
        "reception/appointments",
        "receptionist",
        "/appointments?limit=50",
        ("patientName", "doctorName", "date", "timeSlot", "status"),
    ),
    (
        "reception/billing",
        "receptionist",
        "/billing/invoices/patient/BADP1K3A",
        ("totalAmount", "status", "createdAt"),
    ),
    ("doctor/patients", "doctor", "/patients?limit=50", ("name", "gender")),
    (
        "doctor/appointments",
        "doctor",
        "/appointments?limit=50",
        ("patientName", "date", "timeSlot"),
    ),
    (
        "doctor/dashboard",
        "doctor",
        "/appointments?doctorId=5D4181ZA&limit=20",
        ("patientName", "date", "timeSlot"),
    ),
    (
        "patient/home",
        "patient",
        "/appointments?patientId=BADP1K3A&limit=10",
        ("doctorName", "date", "timeSlot"),
    ),
    (
        "patient/prescriptions",
        "patient",
        "/prescriptions?patientId=BADP1K3A&limit=20",
        ("doctorName", "createdAt", "status"),
    ),
    ("patient/invoices", "patient", "/billing/invoices/patient/BADP1K3A", ("totalAmount",)),
    (
        "pharmacy/dispense",
        "pharmacist",
        "/prescriptions?limit=30",
        ("patientName", "doctorName", "createdAt"),
    ),
    (
        "pharmacy/medicines",
        "pharmacist",
        "/inventory/medicines?limit=50",
        ("name", "category", "totalQuantity", "mrp"),
    ),
    ("pharmacy/purchases", "pharmacist", "/purchases/orders?limit=30", ("status", "createdAt")),
    ("admin/overview", "hospital_admin", "/inventory/summary", ()),
    ("admin/overview", "hospital_admin", "/reports/dashboard", ()),
    (
        "admin/inventory",
        "hospital_admin",
        "/inventory/medicines?limit=50",
        ("name", "totalQuantity", "reorderLevel"),
    ),
    ("admin/staff", "hospital_admin", "/doctors", ("name", "specialty", "consultationFee")),
    ("admin/purchases", "hospital_admin", "/purchases/orders?limit=50", ("status",)),
    ("admin/sales", "hospital_admin", "/sales?limit=50", ()),
]


def load_env() -> None:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ["ALLOW_MOCK_AUTH"] = "true"
    # Assert CORS against the real browser origin rather than whatever .env allows locally.
    os.environ["CORS_ORIGINS"] = f"{WEB_ORIGIN},http://localhost:3001"
    # Settings are cached — clear so the overrides above take effect.
    from app.config import get_settings

    get_settings.cache_clear()


def rows_of(payload: object) -> list[dict]:
    if isinstance(payload, dict):
        data = payload.get("data", payload)
        if isinstance(data, dict):
            data = data.get("items", [])
        return data if isinstance(data, list) else []
    return payload if isinstance(payload, list) else []


async def main() -> None:
    load_env()
    from api.index import app

    if not isinstance(app, FastAPI):
        raise SystemExit(
            "entrypoint fell back to the startup diagnostic — app.main failed to import"
        )

    failures: list[str] = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        preflight = await client.options(
            "/api/v1/appointments",
            headers={"Origin": WEB_ORIGIN, "Access-Control-Request-Method": "GET"},
        )
        allow_origin = preflight.headers.get("access-control-allow-origin")
        print(f"CORS preflight  {preflight.status_code}  {allow_origin}")
        if allow_origin != WEB_ORIGIN:
            failures.append(f"CORS returned {allow_origin!r}")

        live = await client.get("/health/live")
        print(f"health/live     {live.status_code}  {live.text}")

        print(f"\n{'page':24} {'role':15} {'code':5} {'rows':5} detail")
        for page, role, path, fields in CALLS:
            response = await client.get(
                f"/api/v1{path}",
                headers={
                    "Authorization": f"Bearer mock-{role}",
                    "X-Hospital-ID": HOSPITAL,
                },
            )
            detail = ""
            rows = []
            if response.status_code != 200:
                detail = response.text[:110]
                failures.append(f"{page} {path} -> {response.status_code} {detail}")
            else:
                rows = rows_of(response.json())
                if fields and not rows:
                    detail = "no rows"
                    failures.append(f"{page} {path} -> returned no rows")
                elif rows:
                    # Blank in every row means the API never populates it; blank in some rows
                    # is just sparse data (an out-of-stock medicine has no price, for instance).
                    blank = [
                        f for f in fields if all(row.get(f) in (None, "") for row in rows)
                    ]
                    if blank:
                        detail = f"blank fields: {', '.join(blank)}"
                        failures.append(f"{page} {path} -> blank {blank}")
            print(f"{page:24} {role:15} {response.status_code:<5} {len(rows):<5} {detail}")

    print()
    if failures:
        print(f"{len(failures)} PROBLEM(S):")
        for failure in failures:
            print(f"  - {failure}")
        raise SystemExit(1)
    print("ALL PASS")


if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
