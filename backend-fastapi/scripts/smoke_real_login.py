"""Sign in with real Firebase credentials and load every page of each role's portal.

Mock auth is forced off, so a pass here proves the whole production path: password sign-in
against Firebase, ID token verification, the auth.users join that supplies the role and
tenant, and the record ids /me hands the patient and doctor portals.

    .venv/Scripts/python scripts/smoke_real_login.py                     # in-process
    .venv/Scripts/python scripts/smoke_real_login.py https://nabhicares.vercel.app

Needs DEMO_USER_PASSWORD, the password given to scripts/provision_portal_users.py.
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
from pathlib import Path

from httpx import ASGITransport, AsyncClient

WEB_ORIGIN = "https://cares.nabhilabs.com"
SIGN_IN = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
FIREBASE_CONFIG = Path(__file__).resolve().parents[2] / "web" / "src" / "lib" / "firebase.ts"

# role -> expected email
ACCOUNTS = {
    "super_admin": "owner@nabhicares.com",
    "hospital_admin": "admin@nabhicares.com",
    "doctor": "doctor@nabhicares.com",
    "receptionist": "reception@nabhicares.com",
    "pharmacist": "pharmacy@nabhicares.com",
    "patient": "patient@nabhicares.com",
}

# role -> (page, path template, fields the page's table reads)
PAGES: dict[str, list[tuple[str, str, tuple[str, ...]]]] = {
    "patient": [
        ("patient/home", "/appointments?patientId={patientId}&limit=10", ("doctorName", "date")),
        (
            "patient/appointments",
            "/appointments?patientId={patientId}&limit=50",
            ("doctorName", "timeSlot", "status"),
        ),
        (
            "patient/prescriptions",
            "/prescriptions?patientId={patientId}&limit=20",
            ("doctorName", "createdAt", "status"),
        ),
        ("patient/invoices", "/billing/invoices/patient/{patientId}", ("totalAmount",)),
    ],
    "doctor": [
        (
            "doctor/dashboard",
            "/appointments?doctorId={doctorId}&limit=20",
            ("patientName", "date", "timeSlot"),
        ),
        (
            "doctor/appointments",
            "/appointments?doctorId={doctorId}&limit=50",
            ("patientName", "timeSlot"),
        ),
        ("doctor/patients", "/patients?limit=50", ("name", "gender")),
    ],
    "receptionist": [
        ("reception/patients", "/patients?limit=50", ("name", "phone", "dateOfBirth")),
        (
            "reception/appointments",
            "/appointments?limit=50",
            ("patientName", "doctorName", "date", "status"),
        ),
        ("reception/billing", "/patients?limit=100", ("medicalRecordNumber", "name")),
    ],
    "pharmacist": [
        ("pharmacy/dispense", "/prescriptions?limit=30", ("patientName", "doctorName")),
        (
            "pharmacy/medicines",
            "/inventory/medicines?limit=50",
            ("name", "category", "totalQuantity", "mrp"),
        ),
        ("pharmacy/purchases", "/purchases/orders?limit=30", ("status", "createdAt")),
    ],
    "hospital_admin": [
        ("admin/overview", "/inventory/summary", ()),
        ("admin/overview", "/reports/dashboard", ()),
        (
            "admin/inventory",
            "/inventory/medicines?limit=50",
            ("name", "totalQuantity", "reorderLevel"),
        ),
        ("admin/staff", "/doctors", ("name", "specialty", "consultationFee")),
        ("admin/purchases", "/purchases/orders?limit=50", ("status",)),
        ("admin/sales", "/sales?limit=50", ()),
    ],
    "super_admin": [
        ("admin/overview", "/reports/dashboard", ()),
        ("admin/staff", "/doctors", ("name", "specialty")),
    ],
}


def load_env() -> None:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    # The point of this run is the real token path.
    os.environ["ALLOW_MOCK_AUTH"] = "false"
    os.environ["CORS_ORIGINS"] = f"{WEB_ORIGIN},http://localhost:3001"
    from app.config import get_settings

    get_settings.cache_clear()


def rows_of(payload: object) -> list[dict]:
    if isinstance(payload, dict):
        data = payload.get("data", payload)
        if isinstance(data, dict):
            data = data.get("items", [])
        return data if isinstance(data, list) else []
    return payload if isinstance(payload, list) else []


def web_api_key() -> str:
    """The key the browser signs in with, taken from the web app so the two cannot drift."""
    found = re.search(r'apiKey:\s*"([^"]+)"', FIREBASE_CONFIG.read_text(encoding="utf-8"))
    if not found:
        raise SystemExit(f"No apiKey found in {FIREBASE_CONFIG}")
    return found.group(1)


async def sign_in(client: AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        SIGN_IN,
        params={"key": web_api_key()},
        json={"email": email, "password": password, "returnSecureToken": True},
    )
    if response.status_code != 200:
        raise RuntimeError(f"{email}: {response.json().get('error', {}).get('message', 'failed')}")
    return response.json()["idToken"]


async def main() -> int:
    load_env()
    password = os.environ.get("DEMO_USER_PASSWORD")
    if not password:
        print("Set DEMO_USER_PASSWORD to the password used when provisioning the accounts")
        return 1

    base = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else None
    if base:
        api = AsyncClient(base_url=base, timeout=60)
    else:
        from api.index import app

        api = AsyncClient(transport=ASGITransport(app=app), base_url="http://test", timeout=60)

    failures: list[str] = []
    # Firebase sign-in is a real network call even when the API runs in-process.
    async with AsyncClient(timeout=60) as google, api:
        print(f"target: {base or 'in-process ASGI'}\n")
        print(f"{'page':24} {'role':15} {'code':5} {'rows':5} detail")
        for role, email in ACCOUNTS.items():
            try:
                token = await sign_in(google, email, password)
            except RuntimeError as exc:
                failures.append(str(exc))
                print(f"{'sign-in':24} {role:15} FAIL  {'':5} {exc}")
                continue

            headers = {"Authorization": f"Bearer {token}"}
            me = await api.get("/api/v1/me", headers=headers)
            if me.status_code != 200:
                failures.append(f"{role} /me -> {me.status_code} {me.text[:110]}")
                print(f"{'me':24} {role:15} {me.status_code:<5} {'':5} {me.text[:110]}")
                continue
            profile = me.json()["data"]
            if profile["role"] != role:
                failures.append(f"{email} resolved as {profile['role']}, expected {role}")
            ids = {
                "patientId": profile.get("patientId") or "",
                "doctorId": profile.get("doctorId") or "",
            }
            print(
                f"{'me':24} {role:15} {me.status_code:<5} {'':5} "
                f"{profile['role']} / {profile.get('hospitalName')} / "
                f"patient={ids['patientId'] or '-'} doctor={ids['doctorId'] or '-'}"
            )

            for page, template, fields in PAGES[role]:
                if "{patientId}" in template and not ids["patientId"]:
                    failures.append(f"{page}: /me returned no patientId for {email}")
                    continue
                if "{doctorId}" in template and not ids["doctorId"]:
                    failures.append(f"{page}: /me returned no doctorId for {email}")
                    continue
                path = template.format(**ids)
                response = await api.get(f"/api/v1{path}", headers=headers)
                detail = ""
                rows: list[dict] = []
                if response.status_code != 200:
                    detail = response.text[:110]
                    failures.append(f"{page} {path} -> {response.status_code} {detail}")
                else:
                    rows = rows_of(response.json())
                    if fields and not rows:
                        detail = "no rows"
                        failures.append(f"{page} {path} -> returned no rows")
                    elif rows:
                        # Blank in every row means the API never fills it; blank in some is
                        # just sparse data, such as a medicine with no price yet.
                        blank = [f for f in fields if all(r.get(f) in (None, "") for r in rows)]
                        if blank:
                            detail = f"blank fields: {', '.join(blank)}"
                            failures.append(f"{page} {path} -> blank {blank}")
                print(f"{page:24} {role:15} {response.status_code:<5} {len(rows):<5} {detail}")
            print()

    if failures:
        print(f"{len(failures)} PROBLEM(S):")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    raise SystemExit(asyncio.run(main()))
