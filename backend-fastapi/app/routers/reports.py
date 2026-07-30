"""Prescriptions and reports — endpoints the web portal already calls."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, require_hospital, require_roles, scope_session
from ..db import get_session
from ..models import Appointment, Doctor, Invoice, Patient, Prescription, PrescriptionItem

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]


def _rx_row(
    row: Prescription,
    *,
    patient_name: str | None,
    doctor_name: str | None,
    items: list[PrescriptionItem],
) -> dict:
    # Web tables hardcode camelCase; snake_case from serialize() would leave cells blank.
    return {
        "id": str(row.id),
        "patientId": str(row.patient_id),
        "doctorId": str(row.doctor_id),
        "patientName": patient_name,
        "doctorName": doctor_name,
        "status": row.status,
        "notes": row.notes,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "items": [
            {
                "id": str(item.id),
                "medicineName": item.medicine_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
                "durationDays": item.duration_days,
                "quantity": item.quantity,
                "instructions": item.instructions,
            }
            for item in items
        ],
    }


async def _patient_uuid(session: AsyncSession, hospital_id: uuid.UUID, raw: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError:
        pass
    patient = await session.scalar(
        select(Patient).where(
            Patient.hospital_id == hospital_id,
            Patient.medical_record_number == raw,
            Patient.deleted_at.is_(None),
        )
    )
    if not patient:
        raise HTTPException(404, f"Patient '{raw}' not found")
    return patient.id


@router.get("/prescriptions")
async def list_prescriptions(
    session: Session,
    user: Annotated[
        CurrentUser,
        Depends(
            require_roles(
                "super_admin",
                "hospital_admin",
                "doctor",
                "pharmacist",
                "patient",
                "receptionist",
            )
        ),
    ],
    patient_id: str | None = Query(None, alias="patientId"),
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)

    stmt = select(Prescription).where(Prescription.hospital_id == hospital_id)
    if patient_id:
        stmt = stmt.where(
            Prescription.patient_id == await _patient_uuid(session, hospital_id, patient_id)
        )
    if status:
        stmt = stmt.where(Prescription.status == status)
    elif not patient_id and user.role == "pharmacist":
        stmt = stmt.where(Prescription.status.in_(("active", "pending", "partial")))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await session.scalars(
            stmt.order_by(Prescription.created_at.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).all()

    patient_ids = {r.patient_id for r in rows}
    doctor_ids = {r.doctor_id for r in rows}
    patients = {
        p.id: p.name
        for p in (
            await session.scalars(select(Patient).where(Patient.id.in_(patient_ids)))
            if patient_ids
            else []
        )
    }
    doctors = {
        d.id: d.name
        for d in (
            await session.scalars(select(Doctor).where(Doctor.id.in_(doctor_ids)))
            if doctor_ids
            else []
        )
    }
    items_by_rx: dict[uuid.UUID, list[PrescriptionItem]] = {r.id: [] for r in rows}
    if rows:
        for item in await session.scalars(
            select(PrescriptionItem).where(
                PrescriptionItem.prescription_id.in_([r.id for r in rows])
            )
        ):
            items_by_rx.setdefault(item.prescription_id, []).append(item)

    return {
        "items": [
            _rx_row(
                r,
                patient_name=patients.get(r.patient_id),
                doctor_name=doctors.get(r.doctor_id),
                items=items_by_rx.get(r.id, []),
            )
            for r in rows
        ],
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.get("/reports/dashboard")
async def dashboard_report(
    session: Session,
    user: Annotated[CurrentUser, Depends(require_roles("super_admin", "hospital_admin"))],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)

    start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    total_patients = await session.scalar(
        select(func.count())
        .select_from(Patient)
        .where(Patient.hospital_id == hospital_id, Patient.deleted_at.is_(None))
    )
    today_appointments = await session.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.hospital_id == hospital_id,
            Appointment.deleted_at.is_(None),
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
        )
    )
    revenue = await session.scalar(
        select(func.coalesce(func.sum(Invoice.total_amount), 0)).where(
            Invoice.hospital_id == hospital_id,
            Invoice.status.in_(("paid", "partially_paid")),
        )
    )

    return {
        "totalPatients": total_patients or 0,
        "todayAppointments": today_appointments or 0,
        "totalRevenue": float(revenue) if isinstance(revenue, Decimal) else (revenue or 0),
        "timestamp": datetime.now(UTC).isoformat(),
    }
