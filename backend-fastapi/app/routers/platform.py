import hashlib
import time
from datetime import UTC, datetime
from typing import Annotated

import cloudinary
import cloudinary.utils
from fastapi import APIRouter, Depends, Header, HTTPException
from firebase_admin import messaging
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from ..auth import (
    CurrentUser,
    firebase_app,
    get_current_user,
    require_hospital,
    require_roles,
    scope_session,
)
from ..config import get_settings
from ..db import get_session
from ..models import (
    DeviceToken,
    Doctor,
    Document,
    Hospital,
    Notification,
    NotificationLog,
    Patient,
    Role,
    User,
)
from ..responses import serialize
from ..schemas import (
    BootstrapRequest,
    DeviceTokenCreate,
    DocumentMetadataCreate,
    NotificationCreate,
)

router = APIRouter()
settings = get_settings()
cloudinary.config(cloudinary_url=settings.cloudinary_url, secure=True)
Session = Annotated[AsyncSession, Depends(get_session)]
Admin = Annotated[
    CurrentUser,
    Depends(require_roles("super_admin", "hospital_admin")),
]
Authenticated = Annotated[CurrentUser, Depends(get_current_user)]

ROLE_NAMES = (
    "super_admin",
    "hospital_admin",
    "doctor",
    "receptionist",
    "pharmacist",
    "patient",
)


@router.get("/me")
async def me(session: Session, user: Authenticated):
    # A Firebase ID token carries no role, and the patient and doctor portals address
    # their own records by medical record / registration number, so the client has no way
    # to know who it is until it asks.
    await scope_session(session, user)
    hospital_name = None
    if user.hospital_id:
        hospital_name = await session.scalar(
            select(Hospital.name).where(Hospital.id == user.hospital_id)
        )
    patient_id = None
    doctor_id = None
    display_name = None
    if user.id:
        db_user = await session.scalar(select(User).where(User.id == user.id))
        if db_user:
            display_name = db_user.display_name
            db_user.last_login = datetime.now(UTC)
        patient_id = await session.scalar(
            select(Patient.medical_record_number).where(
                Patient.user_id == user.id, Patient.deleted_at.is_(None)
            )
        )
        doctor_id = await session.scalar(
            select(Doctor.registration_number).where(
                Doctor.user_id == user.id, Doctor.deleted_at.is_(None)
            )
        )
        await session.commit()
    return {
        "id": str(user.id) if user.id else None,
        "email": user.email,
        "displayName": display_name,
        "role": user.role,
        "hospitalId": str(user.hospital_id) if user.hospital_id else None,
        "hospitalName": hospital_name,
        "patientId": patient_id,
        "doctorId": doctor_id,
    }


@router.post("/bootstrap", status_code=201)
async def bootstrap(
    body: BootstrapRequest,
    session: Session,
    x_bootstrap_secret: Annotated[str | None, Header()] = None,
):
    if not x_bootstrap_secret or not secrets_equal(x_bootstrap_secret, settings.bootstrap_secret):
        raise HTTPException(403, "Invalid bootstrap secret")
    existing = await session.scalar(
        select(User.id).join(Role, User.role_id == Role.id).where(Role.name == "super_admin")
    )
    if existing:
        raise HTTPException(409, "Bootstrap is permanently closed")
    await session.execute(text("SELECT set_config('app.is_super_admin', 'true', true)"))

    roles = {}
    for name in ROLE_NAMES:
        role = Role(name=name)
        session.add(role)
        roles[name] = role
    await session.flush()
    hospital = Hospital(code=body.hospital_code, name=body.hospital_name)
    session.add(hospital)
    await session.flush()
    user = User(
        firebase_uid=body.firebase_uid,
        hospital_id=None,
        role_id=roles["super_admin"].id,
        email=body.email,
        display_name=body.display_name,
    )
    session.add(user)
    await session.commit()
    return {"hospital": serialize(hospital), "user": serialize(user)}


def secrets_equal(left: str, right: str) -> bool:
    return hashlib.sha256(left.encode()).digest() == hashlib.sha256(right.encode()).digest()


@router.post("/documents/sign-upload")
async def sign_document_upload(user: Admin):
    hospital_id = require_hospital(user)
    timestamp = int(time.time())
    folder = f"nabhi-care/{hospital_id}"
    signature = cloudinary.utils.api_sign_request(
        {"folder": folder, "timestamp": timestamp},
        cloudinary.config().api_secret,
    )
    return {
        "cloudName": cloudinary.config().cloud_name,
        "apiKey": cloudinary.config().api_key,
        "folder": folder,
        "timestamp": timestamp,
        "signature": signature,
    }


@router.post("/documents", status_code=201)
async def save_document_metadata(
    body: DocumentMetadataCreate,
    session: Session,
    user: Admin,
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    expected_prefix = f"nabhi-care/{hospital_id}/"
    if not body.cloudinary_public_id.startswith(expected_prefix):
        raise HTTPException(422, "Cloudinary public ID is outside this hospital folder")
    document = Document(
        **body.model_dump(),
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(document)
    await session.commit()
    return serialize(document)


@router.get("/notifications")
async def list_notifications(
    session: Session,
    user: Authenticated,
    page: int = 1,
    limit: int = 50,
):
    """Inbox for the signed-in user (patient Alerts tab and staff hubs)."""
    if user.id is None:
        return {"items": [], "meta": {"page": page, "limit": limit, "total": 0}}
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(Notification).where(
        Notification.hospital_id == hospital_id,
        Notification.user_id == user.id,
    )
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await session.scalars(
            stmt.order_by(Notification.created_at.desc())
            .offset((max(page, 1) - 1) * limit)
            .limit(min(max(limit, 1), 100))
        )
    ).all()
    return {
        "items": [serialize(row) for row in rows],
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.post("/notifications/device-token", status_code=201)
async def register_device_token(
    body: DeviceTokenCreate,
    session: Session,
    user: Authenticated,
):
    hospital_id = require_hospital(user)
    if user.id is None:
        raise HTTPException(400, "Device registration requires a persisted user")
    await scope_session(session, user)
    token_id = await session.scalar(
        insert(DeviceToken)
        .values(
            hospital_id=hospital_id,
            user_id=user.id,
            token=body.token,
            platform=body.platform,
            active=True,
            created_by=user.id,
            updated_by=user.id,
        )
        .on_conflict_do_update(
            index_elements=[DeviceToken.token],
            set_={
                "hospital_id": hospital_id,
                "user_id": user.id,
                "platform": body.platform,
                "active": True,
                "updated_by": user.id,
                "updated_at": func.now(),
            },
        )
        .returning(DeviceToken.id)
    )
    await session.commit()
    return {"id": str(token_id)}


@router.post("/notifications", status_code=201)
async def send_notification(
    body: NotificationCreate,
    session: Session,
    user: Admin,
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    recipient = await session.scalar(
        select(User.id).where(
            User.id == body.user_id,
            User.hospital_id == hospital_id,
            User.deleted_at.is_(None),
        )
    )
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    notification = Notification(
        hospital_id=hospital_id,
        user_id=body.user_id,
        title=body.title,
        body=body.body,
        payload=body.payload,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(notification)
    await session.flush()
    tokens = list(
        (
            await session.scalars(
                select(DeviceToken.token).where(
                    DeviceToken.hospital_id == hospital_id,
                    DeviceToken.user_id == body.user_id,
                    DeviceToken.active.is_(True),
                )
            )
        ).all()
    )
    if tokens:
        message = messaging.MulticastMessage(
            tokens=tokens[:500],
            notification=messaging.Notification(title=body.title, body=body.body),
            data=body.payload,
        )
        result = await run_in_threadpool(
            messaging.send_each_for_multicast, message, False, firebase_app()
        )
        for index, response in enumerate(result.responses):
            session.add(
                NotificationLog(
                    notification_id=notification.id,
                    provider_message_id=response.message_id if response.success else None,
                    status="sent" if response.success else "failed",
                    error=str(response.exception) if response.exception else None,
                )
            )
            if not response.success:
                token = await session.scalar(
                    select(DeviceToken).where(DeviceToken.token == tokens[index])
                )
                if token:
                    token.active = False
    await session.commit()
    return serialize(notification)


@router.post("/analytics/refresh")
async def refresh_analytics(
    session: Session,
    user: Annotated[CurrentUser, Depends(require_roles("super_admin", "hospital_admin"))],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    await session.execute(
        text(
            """
            INSERT INTO analytics.inventory_summary
                (hospital_id, total_skus, total_units, low_stock_count,
                 out_of_stock_count, expiring_count, refreshed_at)
            SELECT :hospital_id,
                   count(*),
                   coalesce(sum(quantity), 0),
                   count(*) FILTER (WHERE quantity > 0 AND quantity <= reorder_level),
                   count(*) FILTER (WHERE quantity = 0),
                   (
                     SELECT count(*)
                     FROM inventory.medicine_batches b
                     JOIN inventory.stock s ON s.medicine_batch_id = b.id
                     WHERE b.hospital_id = :hospital_id
                       AND b.expiry_date <= current_date + 30
                       AND s.available_quantity > 0
                   ),
                   now()
            FROM (
              SELECT m.id, m.reorder_level,
                     coalesce(sum(s.available_quantity), 0) AS quantity
              FROM inventory.medicines m
              LEFT JOIN inventory.medicine_batches b ON b.medicine_id = m.id
              LEFT JOIN inventory.stock s ON s.medicine_batch_id = b.id
              WHERE m.hospital_id = :hospital_id AND m.deleted_at IS NULL
              GROUP BY m.id
            ) inventory
            ON CONFLICT (hospital_id) DO UPDATE SET
              total_skus = excluded.total_skus,
              total_units = excluded.total_units,
              low_stock_count = excluded.low_stock_count,
              out_of_stock_count = excluded.out_of_stock_count,
              expiring_count = excluded.expiring_count,
              refreshed_at = excluded.refreshed_at
            """
        ),
        {"hospital_id": hospital_id},
    )
    await session.execute(
        text(
            """
            INSERT INTO analytics.daily_sales_summary
                (hospital_id, summary_date, sale_count, gross_amount,
                 tax_amount, discount_amount, refreshed_at)
            SELECT hospital_id, created_at::date, count(*), sum(total_amount),
                   sum(tax_amount), sum(discount_amount), now()
            FROM pharmacy.medicine_sales
            WHERE hospital_id = :hospital_id
            GROUP BY hospital_id, created_at::date
            ON CONFLICT (hospital_id, summary_date) DO UPDATE SET
              sale_count = excluded.sale_count,
              gross_amount = excluded.gross_amount,
              tax_amount = excluded.tax_amount,
              discount_amount = excluded.discount_amount,
              refreshed_at = excluded.refreshed_at
            """
        ),
        {"hospital_id": hospital_id},
    )
    await session.commit()
    return {"refreshed": True}
