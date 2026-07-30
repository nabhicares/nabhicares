"""Resolve the identifiers clients send into internal UUIDs.

Staff refer to a patient by medical record number and to a doctor by registration
number, and the portals carry those identifiers in their URLs, so both forms are
accepted wherever an id is taken from a request.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from .models import Doctor, Patient


async def _resolve(
    session: AsyncSession,
    hospital_id: uuid.UUID,
    raw: str,
    model: type[Doctor | Patient],
    alternate: InstrumentedAttribute,
    label: str,
) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError:
        pass
    found = await session.scalar(
        select(model.id).where(
            model.hospital_id == hospital_id,
            alternate == raw,
            model.deleted_at.is_(None),
        )
    )
    if found is None:
        raise HTTPException(404, f"{label} '{raw}' not found")
    return found


async def patient_uuid(session: AsyncSession, hospital_id: uuid.UUID, raw: str) -> uuid.UUID:
    return await _resolve(
        session, hospital_id, raw, Patient, Patient.medical_record_number, "Patient"
    )


async def doctor_uuid(session: AsyncSession, hospital_id: uuid.UUID, raw: str) -> uuid.UUID:
    return await _resolve(session, hospital_id, raw, Doctor, Doctor.registration_number, "Doctor")
