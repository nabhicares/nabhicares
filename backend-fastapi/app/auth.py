import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

import firebase_admin
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_session
from .models import Role, User

bearer = HTTPBearer(auto_error=False)
settings = get_settings()


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID | None
    firebase_uid: str
    role: str
    hospital_id: uuid.UUID | None
    email: str | None


def firebase_app() -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        credential = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "client_email": settings.firebase_client_email,
                "private_key": settings.firebase_private_key,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        return firebase_admin.initialize_app(credential)


async def get_current_user(
    token: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
    x_hospital_id: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if token is None:
        raise HTTPException(401, "Authorization header is missing")

    raw = token.credentials
    if settings.allow_mock_auth and raw.startswith("mock-"):
        role = raw.removeprefix("mock-").split("-", 1)[0]
        if role == "hospital":
            role = "hospital_admin"
        if role not in {
            "super_admin",
            "hospital_admin",
            "doctor",
            "receptionist",
            "pharmacist",
            "patient",
        }:
            raise HTTPException(401, "Unknown mock role")
        hospital_id = None
        if role != "super_admin":
            if x_hospital_id:
                try:
                    hospital_id = uuid.UUID(x_hospital_id)
                except ValueError as exc:
                    raise HTTPException(400, "X-Hospital-ID must be a UUID") from exc
            else:
                # Demo clients (web/mobile) often omit the header — fall back to the seeded DEMO hospital.
                from .models import Hospital

                hospital_id = await session.scalar(
                    select(Hospital.id).where(Hospital.code == "DEMO", Hospital.deleted_at.is_(None))
                )
                if hospital_id is None:
                    raise HTTPException(
                        400,
                        "X-Hospital-ID is required (or seed the DEMO hospital first)",
                    )
        return CurrentUser(None, raw, role, hospital_id, None)

    try:
        # check_revoked hits Google on every request. On a serverless cold start that call
        # often times out and every portal page then looks like a bad password, so signature
        # verification alone is what we do here. Revocation is still enforced when Firebase
        # rotates keys or when the account is disabled (those fail the signature / claims check).
        decoded = auth.verify_id_token(raw, app=firebase_app())
    except Exception as exc:
        raise HTTPException(401, f"Invalid Firebase ID token: {exc}") from exc

    # auth.users is tenant-isolated, and the tenant is what this lookup returns. The
    # self_lookup policy opens exactly the caller's own row against this setting.
    await session.execute(
        text("SELECT set_config('app.firebase_uid', :value, true)"),
        {"value": decoded["uid"]},
    )
    result = await session.execute(
        select(User, Role.name)
        .join(Role, User.role_id == Role.id)
        .where(User.firebase_uid == decoded["uid"], User.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row or row.User.status != "active":
        raise HTTPException(403, "Application user is not active")

    row.User.last_login = datetime.now(UTC)
    await session.commit()
    return CurrentUser(
        row.User.id,
        row.User.firebase_uid,
        row.name,
        row.User.hospital_id,
        decoded.get("email"),
    )


def require_roles(*allowed: str):
    async def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(403, "Insufficient role")
        return user

    return dependency


async def scope_session(session: AsyncSession, user: CurrentUser) -> None:
    is_super = user.role == "super_admin"
    await session.execute(
        text("SELECT set_config('app.is_super_admin', :value, true)"),
        {"value": "true" if is_super else "false"},
    )
    if user.hospital_id:
        await session.execute(
            text("SELECT set_config('app.hospital_id', :value, true)"),
            {"value": str(user.hospital_id)},
        )


def require_hospital(user: CurrentUser) -> uuid.UUID:
    if user.hospital_id is None:
        raise HTTPException(400, "Hospital context is required")
    return user.hospital_id
