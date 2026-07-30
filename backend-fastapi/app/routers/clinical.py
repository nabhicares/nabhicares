import uuid
from datetime import UTC, datetime, timedelta, time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, require_hospital, require_roles, scope_session
from ..db import get_session
from ..lookup import doctor_uuid, patient_uuid
from ..models import (
    Appointment,
    AppointmentStatusLog,
    Doctor,
    Patient,
)
from ..responses import serialize
from ..schemas import (
    AppointmentCreate,
    AppointmentStatusUpdate,
    DoctorCreate,
    PatientCreate,
    PatientUpdate,
)

CLINICAL_STAFF = require_roles("super_admin", "hospital_admin", "receptionist", "doctor")

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]
User = Annotated[CurrentUser, Depends(get_current_user)]


@router.get("/patients")
async def list_patients(
    session: Session,
    user: User,
    q: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(Patient).where(Patient.hospital_id == hospital_id, Patient.deleted_at.is_(None))
    if q:
        stmt = stmt.where(or_(Patient.name.ilike(f"%{q}%"), Patient.phone.ilike(f"%{q}%")))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await session.scalars(stmt.order_by(Patient.name).offset((page - 1) * limit).limit(limit))
    ).all()
    return {
        "items": [serialize(row) for row in rows],
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.post("/patients", status_code=201)
async def create_patient(
    body: PatientCreate,
    session: Session,
    user: Annotated[CurrentUser, Depends(CLINICAL_STAFF)],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    fields = body.model_dump()
    if not fields.get("medical_record_number"):
        fields["medical_record_number"] = await _next_record_number(session, hospital_id)
    patient = Patient(
        **fields,
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(patient)
    await session.commit()
    return serialize(patient)


@router.patch("/patients/{patient_id}")
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    session: Session,
    user: Annotated[CurrentUser, Depends(CLINICAL_STAFF)],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    patient = await session.scalar(
        select(Patient).where(
            Patient.id == await patient_uuid(session, hospital_id, patient_id),
            Patient.hospital_id == hospital_id,
            Patient.deleted_at.is_(None),
        )
    )
    if not patient:
        raise HTTPException(404, "Patient not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(patient, key, value)
    patient.updated_by = user.id
    payload = serialize(patient)
    await session.commit()
    return payload


async def _next_record_number(session: AsyncSession, hospital_id: uuid.UUID) -> str:
    """Sequential per hospital, so the front desk can read it back over the phone."""
    used = await session.scalar(
        select(func.count())
        .select_from(Patient)
        .where(Patient.hospital_id == hospital_id)
    )
    while True:
        used = (used or 0) + 1
        candidate = f"MRN{used:06d}"
        taken = await session.scalar(
            select(Patient.id).where(
                Patient.hospital_id == hospital_id,
                Patient.medical_record_number == candidate,
            )
        )
        if taken is None:
            return candidate


@router.get("/doctors")
async def list_doctors(
    session: Session,
    user: User,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(Doctor).where(Doctor.hospital_id == hospital_id, Doctor.deleted_at.is_(None))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await session.scalars(stmt.order_by(Doctor.name).offset((page - 1) * limit).limit(limit))
    ).all()
    return {
        # Clients label the field "specialty"; the column keeps the clinical spelling.
        "items": [serialize(row) | {"specialty": row.specialization} for row in rows],
        "meta": {"page": page, "limit": limit, "total": total},
    }


@router.post("/doctors", status_code=201)
async def create_doctor(
    body: DoctorCreate,
    session: Session,
    user: Annotated[CurrentUser, Depends(require_roles("super_admin", "hospital_admin"))],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    doctor = Doctor(
        **body.model_dump(),
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(doctor)
    await session.commit()
    return serialize(doctor)


@router.get("/appointments")
async def list_appointments(
    session: Session,
    user: User,
    patient_id: str | None = Query(None, alias="patientId"),
    doctor_id: str | None = Query(None, alias="doctorId"),
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(Appointment).where(
        Appointment.hospital_id == hospital_id, Appointment.deleted_at.is_(None)
    )
    if patient_id:
        stmt = stmt.where(
            Appointment.patient_id == await patient_uuid(session, hospital_id, patient_id)
        )
    if doctor_id:
        stmt = stmt.where(
            Appointment.doctor_id == await doctor_uuid(session, hospital_id, doctor_id)
        )
    if status:
        stmt = stmt.where(Appointment.status == status)
    rows = (
        await session.scalars(
            stmt.order_by(Appointment.starts_at.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).all()

    names = await _participant_names(session, rows)
    return [serialize(row) | _appointment_view(row, names) for row in rows]


async def _participant_names(
    session: AsyncSession, rows: list[Appointment]
) -> dict[uuid.UUID, str]:
    if not rows:
        return {}
    names: dict[uuid.UUID, str] = {}
    for model, ids in (
        (Patient, {row.patient_id for row in rows}),
        (Doctor, {row.doctor_id for row in rows}),
    ):
        for found_id, name in await session.execute(
            select(model.id, model.name).where(model.id.in_(ids))
        ):
            names[found_id] = name
    return names


def _appointment_view(row: Appointment, names: dict[uuid.UUID, str]) -> dict:
    # Clients render a calendar day and a slot label rather than a timestamp.
    return {
        "patientName": names.get(row.patient_id),
        "doctorName": names.get(row.doctor_id),
        "date": row.starts_at.date().isoformat(),
        "timeSlot": row.starts_at.strftime("%H:%M"),
    }


def _starts_from_body(body: AppointmentCreate) -> tuple[datetime, datetime | None]:
    if body.starts_at is not None:
        return body.starts_at, body.ends_at
    assert body.visit_date is not None and body.time_slot
    try:
        hour, minute = (int(part) for part in body.time_slot.split(":", 1))
    except ValueError as exc:
        raise HTTPException(400, "timeSlot must be HH:MM") from exc
    starts = datetime.combine(body.visit_date, time(hour, minute), tzinfo=UTC)
    return starts, starts + timedelta(minutes=30)


@router.post("/appointments", status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    session: Session,
    user: Annotated[
        CurrentUser,
        Depends(require_roles("super_admin", "hospital_admin", "receptionist", "patient")),
    ],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)

    patient_key = body.patient_id
    if user.role == "patient":
        if user.id is None:
            raise HTTPException(400, "Patient account is not linked")
        own_mrn = await session.scalar(
            select(Patient.medical_record_number).where(
                Patient.user_id == user.id,
                Patient.hospital_id == hospital_id,
                Patient.deleted_at.is_(None),
            )
        )
        if own_mrn is None:
            raise HTTPException(403, "No patient record for this account")
        patient_key = own_mrn

    assert patient_key and body.doctor_id
    patient_id = await patient_uuid(session, hospital_id, patient_key)
    doctor_id = await doctor_uuid(session, hospital_id, body.doctor_id)
    starts_at, ends_at = _starts_from_body(body)

    collision = await session.scalar(
        select(Appointment.id).where(
            Appointment.hospital_id == hospital_id,
            Appointment.doctor_id == doctor_id,
            Appointment.starts_at == starts_at,
            Appointment.status.not_in(("cancelled", "completed")),
            Appointment.deleted_at.is_(None),
        )
    )
    if collision:
        raise HTTPException(409, "Doctor is already booked for this time")

    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        branch_id=body.branch_id,
        starts_at=starts_at,
        ends_at=ends_at,
        reason=body.reason,
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(appointment)
    await session.flush()
    session.add(
        AppointmentStatusLog(
            hospital_id=hospital_id,
            appointment_id=appointment.id,
            to_status="booked",
            changed_by=user.id,
        )
    )
    await session.commit()
    return serialize(appointment)


@router.patch("/appointments/{appointment_id}/status")
async def change_appointment_status(
    appointment_id: uuid.UUID,
    body: AppointmentStatusUpdate,
    session: Session,
    user: Annotated[
        CurrentUser,
        Depends(
            require_roles(
                "super_admin",
                "hospital_admin",
                "receptionist",
                "doctor",
                "patient",
            )
        ),
    ],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    appointment = await session.scalar(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.hospital_id == hospital_id,
            Appointment.deleted_at.is_(None),
        )
    )
    if not appointment:
        raise HTTPException(404, "Appointment not found")

    if user.role == "patient":
        if body.status != "cancelled":
            raise HTTPException(403, "Patients may only cancel their appointments")
        if user.id is None:
            raise HTTPException(400, "Patient account is not linked")
        own_patient_id = await session.scalar(
            select(Patient.id).where(
                Patient.user_id == user.id,
                Patient.hospital_id == hospital_id,
                Patient.deleted_at.is_(None),
            )
        )
        if own_patient_id is None or appointment.patient_id != own_patient_id:
            raise HTTPException(403, "Not your appointment")

    transitions = {
        "booked": {"confirmed", "cancelled"},
        "confirmed": {"checked_in", "cancelled"},
        "checked_in": {"consultation", "cancelled"},
        "consultation": {"completed"},
        "completed": set(),
        "cancelled": set(),
    }
    if body.status not in transitions.get(appointment.status, set()):
        raise HTTPException(409, f"Cannot move {appointment.status} to {body.status}")

    old_status = appointment.status
    appointment.status = body.status
    appointment.updated_by = user.id
    session.add(
        AppointmentStatusLog(
            hospital_id=hospital_id,
            appointment_id=appointment.id,
            from_status=old_status,
            to_status=body.status,
            changed_by=user.id,
            note=body.note,
        )
    )
    # Snapshot before commit — Vercel + FOR UPDATE left the connection wedged so the
    # response middleware returned a bare 500 even though the row had already updated.
    payload = serialize(appointment)
    await session.commit()
    return payload
