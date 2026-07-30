"""Create the sign-in accounts the portals use, in Firebase Auth and in the database.

A request is authorised by joining the Firebase ID token's uid to auth.users, so an
account only works when it exists in both places. Re-running is safe: existing accounts
have their password reset and their role re-applied rather than being duplicated.

    .venv/Scripts/python scripts/provision_portal_users.py

The password comes from DEMO_USER_PASSWORD; one is generated and printed when unset.
Uses DATABASE_MIGRATION_URL (avnadmin) because the runtime role is RLS-bound and cannot
write users before any session context exists.
"""

from __future__ import annotations

import os
import secrets
import uuid
from pathlib import Path

import firebase_admin
import psycopg
from firebase_admin import auth, credentials

NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")
DEMO_CODE = "DEMO"

ROLE_NAMES = (
    "super_admin",
    "hospital_admin",
    "doctor",
    "receptionist",
    "pharmacist",
    "patient",
)

# email, role, display name, patient record, doctor record
ACCOUNTS = [
    ("owner@nabhicares.com", "super_admin", "Platform Owner", None, None),
    ("admin@nabhicares.com", "hospital_admin", "Hospital Admin", None, None),
    ("doctor@nabhicares.com", "doctor", "Dr. Gregory House", None, "5D4181ZA"),
    ("reception@nabhicares.com", "receptionist", "Front Desk", None, None),
    ("pharmacy@nabhicares.com", "pharmacist", "Pharmacy Counter", None, None),
    ("patient@nabhicares.com", "patient", "Alice Patient", "BADP1K3A", None),
]


def load_env() -> None:
    env = Path(__file__).resolve().parent.parent / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def firebase_init() -> None:
    firebase_admin.initialize_app(
        credentials.Certificate(
            {
                "type": "service_account",
                "project_id": os.environ["FIREBASE_PROJECT_ID"],
                "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
                # The key is stored on one line in .env, as the platform env vars require.
                "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
    )


def firebase_account(email: str, display_name: str, password: str) -> str:
    try:
        user = auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        return auth.create_user(
            email=email, password=password, display_name=display_name, email_verified=True
        ).uid
    auth.update_user(user.uid, password=password, display_name=display_name)
    return user.uid


def main() -> int:
    load_env()
    password = os.environ.get("DEMO_USER_PASSWORD")
    generated = password is None
    if generated:
        password = "Nabhi-" + secrets.token_urlsafe(12)

    firebase_init()
    url = os.environ.get("DATABASE_MIGRATION_URL") or os.environ["DATABASE_URL"]

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(
            "select id from hospital.hospitals where code = %s and deleted_at is null",
            (DEMO_CODE,),
        )
        row = cur.fetchone()
        if row is None:
            print(f"Hospital {DEMO_CODE} is missing — run seed_demo_hospital.py first")
            return 1
        hospital = row[0]

        roles: dict[str, uuid.UUID] = {}
        for name in ROLE_NAMES:
            cur.execute(
                """
                insert into auth.roles (id, name) values (%s, %s)
                on conflict (name) do update set name = excluded.name
                returning id
                """,
                (uuid.uuid5(NAMESPACE, f"role:{name}"), name),
            )
            roles[name] = cur.fetchone()[0]

        print(f"{'email':30} {'role':15} {'linked record':16} uid")
        for email, role, display_name, mrn, registration in ACCOUNTS:
            uid = firebase_account(email, display_name, password)
            cur.execute(
                """
                insert into auth.users
                  (id, firebase_uid, hospital_id, role_id, email, display_name, status)
                values (%s, %s, %s, %s, %s, %s, 'active')
                on conflict (firebase_uid) do update
                  set hospital_id = excluded.hospital_id,
                      role_id = excluded.role_id,
                      email = excluded.email,
                      display_name = excluded.display_name,
                      status = 'active',
                      deleted_at = null
                returning id
                """,
                (
                    uuid.uuid5(NAMESPACE, f"user:{email}"),
                    uid,
                    # Super admins are given the demo tenant too: the admin portal reads
                    # hospital-scoped endpoints, which reject a caller with no tenant.
                    hospital,
                    roles[role],
                    email,
                    display_name,
                ),
            )
            user_id = cur.fetchone()[0]

            linked = "-"
            if mrn:
                cur.execute(
                    """
                    update patient.patients set user_id = %s
                    where hospital_id = %s and medical_record_number = %s
                    """,
                    (user_id, hospital, mrn),
                )
                linked = mrn if cur.rowcount else f"{mrn} MISSING"
            if registration:
                cur.execute(
                    """
                    update doctor.doctors set user_id = %s
                    where hospital_id = %s and registration_number = %s
                    """,
                    (user_id, hospital, registration),
                )
                linked = registration if cur.rowcount else f"{registration} MISSING"
            print(f"{email:30} {role:15} {linked:16} {uid}")

        conn.commit()

    if generated:
        print(f"\nPassword for every account above: {password}")
        print("Set DEMO_USER_PASSWORD to choose your own, then re-run to change it.")
    else:
        print("\nPassword: taken from DEMO_USER_PASSWORD")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
