"""Create or update one hospital sign-in account, in Firebase Auth and in the database.

A request is authorised by joining the Firebase ID token's uid to auth.users, so an
account only works when it exists in both places. Re-running for the same email is
safe: the role, hospital and linked record are re-applied instead of duplicated.

    .venv/Scripts/python scripts/provision_user.py \
        --hospital-code CITYGEN --email nurse@cityhospital.in \
        --role receptionist --name "Front Desk"

Optional links to a clinical record:

    --mrn MRN0001            patient accounts (their own bookings and bills)
    --registration DOC-1042  doctor accounts (their own queue)

A password is generated and printed unless --password is given. Uses
DATABASE_MIGRATION_URL (avnadmin) because the runtime role is RLS-bound and cannot
write users before any session context exists.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
import uuid
from pathlib import Path

import firebase_admin
import psycopg
from firebase_admin import auth, credentials

NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")

ROLE_NAMES = (
    "super_admin",
    "hospital_admin",
    "doctor",
    "receptionist",
    "pharmacist",
    "patient",
)


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hospital-code", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", required=True, choices=ROLE_NAMES)
    parser.add_argument("--name", required=True, help="Display name shown in the portals")
    parser.add_argument("--password", help="Generated and printed when omitted")
    parser.add_argument("--mrn", help="Medical record number to link, for patient accounts")
    parser.add_argument("--registration", help="Registration number to link, for doctor accounts")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env()
    password = args.password or "Care-" + secrets.token_urlsafe(12)

    firebase_init()
    url = os.environ.get("DATABASE_MIGRATION_URL") or os.environ["DATABASE_URL"]

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(
            "select id from hospital.hospitals where code = %s and deleted_at is null",
            (args.hospital_code,),
        )
        row = cur.fetchone()
        if row is None:
            print(f"No hospital with code {args.hospital_code}", file=sys.stderr)
            return 1
        hospital = row[0]

        cur.execute(
            """
            insert into auth.roles (id, name) values (%s, %s)
            on conflict (name) do update set name = excluded.name
            returning id
            """,
            (uuid.uuid5(NAMESPACE, f"role:{args.role}"), args.role),
        )
        role_id = cur.fetchone()[0]

        uid = firebase_account(args.email, args.name, password)
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
                uuid.uuid5(NAMESPACE, f"user:{args.email}"),
                uid,
                hospital,
                role_id,
                args.email,
                args.name,
            ),
        )
        user_id = cur.fetchone()[0]

        linked = "-"
        if args.mrn:
            cur.execute(
                """
                update patient.patients set user_id = %s
                where hospital_id = %s and medical_record_number = %s
                """,
                (user_id, hospital, args.mrn),
            )
            if not cur.rowcount:
                print(f"No patient {args.mrn} in {args.hospital_code}", file=sys.stderr)
                return 1
            linked = args.mrn
        if args.registration:
            cur.execute(
                """
                update doctor.doctors set user_id = %s
                where hospital_id = %s and registration_number = %s
                """,
                (user_id, hospital, args.registration),
            )
            if not cur.rowcount:
                print(f"No doctor {args.registration} in {args.hospital_code}", file=sys.stderr)
                return 1
            linked = args.registration

        conn.commit()

    print(f"{args.email}  role={args.role}  linked={linked}  uid={uid}")
    if not args.password:
        print(f"Password: {password}")
        print("Share it over a channel the user can change it from, then rotate on first login.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
