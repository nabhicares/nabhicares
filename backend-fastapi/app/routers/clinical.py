import uuid
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
)

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
    user: Annotated[
        CurrentUser,
        Depends(require_roles("super_admin", "hospital_admin", "receptionist", "doctor")),
    ],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    patient = Patient(
        **body.model_dump(),
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(patient)
    await session.commit()
    return serialize(patient)


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
    patient = await session.scalar(
        select(Patient.id).where(Patient.id == body.patient_id, Patient.hospital_id == hospital_id)
    )
    doctor = await session.scalar(
        select(Doctor.id).where(Doctor.id == body.doctor_id, Doctor.hospital_id == hospital_id)
    )
    if not patient or not doctor:
        raise HTTPException(404, "Patient or doctor not found in this hospital")

    collision = await session.scalar(
        select(Appointment.id).where(
            Appointment.hospital_id == hospital_id,
            Appointment.doctor_id == body.doctor_id,
            Appointment.starts_at == body.starts_at,
            Appointment.status.not_in(("cancelled", "completed")),
            Appointment.deleted_at.is_(None),
        )
    )
    if collision:
        raise HTTPException(409, "Doctor is already booked for this time")

    appointment = Appointment(
        **body.model_dump(),
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
        Depends(require_roles("super_admin", "hospital_admin", "receptionist", "doctor")),
    ],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    appointment = await session.scalar(
        select(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.hospital_id == hospital_id,
            Appointment.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not appointment:
        raise HTTPException(404, "Appointment not found")

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
    await session.commit()
    return serialize(appointment)
