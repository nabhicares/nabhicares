import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, require_hospital, require_roles, scope_session
from ..db import get_session
from ..models import (
    Customer,
    Hospital,
    Invoice,
    InvoiceItem,
    Medicine,
    MedicineBatch,
    MedicineSale,
    MedicineSaleItem,
    Payment,
)
from ..responses import serialize
from ..schemas import PaymentCreate, ProfileUpdate

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]
BillingStaff = Annotated[
    CurrentUser,
    Depends(require_roles("super_admin", "hospital_admin", "pharmacist", "receptionist")),
]


@router.post("/sales/{sale_id}/invoice", status_code=201)
async def create_sale_invoice(sale_id: uuid.UUID, session: Session, user: BillingStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    existing = await session.scalar(
        select(Invoice).where(Invoice.hospital_id == hospital_id, Invoice.sale_id == sale_id)
    )
    if existing:
        return serialize(existing)

    sale = await session.scalar(
        select(MedicineSale)
        .where(MedicineSale.id == sale_id, MedicineSale.hospital_id == hospital_id)
        .with_for_update()
    )
    if not sale:
        raise HTTPException(404, "Sale not found")
    customer = await session.get(Customer, sale.customer_id) if sale.customer_id else None
    invoice = Invoice(
        hospital_id=hospital_id,
        invoice_number=f"INV-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        patient_id=customer.patient_id if customer else None,
        sale_id=sale.id,
        subtotal=sale.subtotal,
        discount_amount=sale.discount_amount,
        tax_amount=sale.tax_amount,
        total_amount=sale.total_amount,
        paid_amount=sale.total_amount if sale.payment_method != "credit" else 0,
        status="paid" if sale.payment_method != "credit" else "unpaid",
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(invoice)
    await session.flush()
    rows = (
        await session.execute(
            select(MedicineSaleItem, MedicineBatch, Medicine.name)
            .join(
                MedicineBatch,
                MedicineBatch.id == MedicineSaleItem.medicine_batch_id,
            )
            .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
            .where(MedicineSaleItem.sale_id == sale.id)
        )
    ).all()
    session.add_all(
        [
            InvoiceItem(
                invoice_id=invoice.id,
                item_type="medicine",
                reference_id=row.MedicineBatch.id,
                description=f"{row.name} ({row.MedicineBatch.batch_number})",
                quantity=row.MedicineSaleItem.quantity,
                unit_price=row.MedicineSaleItem.unit_price,
                tax_amount=row.MedicineSaleItem.tax_amount,
                total_amount=row.MedicineSaleItem.line_total,
            )
            for row in rows
        ]
    )
    await session.commit()
    return serialize(invoice)


@router.get("/billing/invoices/patient/{patient_id}")
async def patient_invoices(patient_id: uuid.UUID, session: Session, user: BillingStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    rows = (
        await session.scalars(
            select(Invoice)
            .where(
                Invoice.hospital_id == hospital_id,
                Invoice.patient_id == patient_id,
            )
            .order_by(Invoice.created_at.desc())
        )
    ).all()
    return [serialize(row) for row in rows]


@router.post("/billing/payments", status_code=201)
async def record_payment(body: PaymentCreate, session: Session, user: BillingStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    invoice = await session.scalar(
        select(Invoice)
        .where(Invoice.id == body.invoice_id, Invoice.hospital_id == hospital_id)
        .with_for_update()
    )
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    remaining = invoice.total_amount - invoice.paid_amount
    if body.amount > remaining:
        raise HTTPException(409, "Payment exceeds invoice balance")
    payment = Payment(
        hospital_id=hospital_id,
        invoice_id=invoice.id,
        sale_id=invoice.sale_id,
        payment_method=body.payment_method,
        amount=body.amount,
        transaction_reference=body.transaction_reference,
        created_by=user.id,
        updated_by=user.id,
    )
    invoice.paid_amount += body.amount
    invoice.status = "paid" if invoice.paid_amount == invoice.total_amount else "partial"
    invoice.updated_by = user.id
    session.add(payment)
    await session.commit()
    return serialize(payment)


@router.get("/profile")
async def get_profile(session: Session, user: BillingStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    profile = await session.get(Hospital, hospital_id)
    if not profile:
        raise HTTPException(404, "Hospital not found")
    return serialize(profile)


@router.patch("/profile")
async def update_profile(
    body: ProfileUpdate,
    session: Session,
    user: Annotated[CurrentUser, Depends(require_roles("super_admin", "hospital_admin"))],
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    profile = await session.scalar(
        select(Hospital).where(Hospital.id == hospital_id).with_for_update()
    )
    if not profile:
        raise HTTPException(404, "Hospital not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    profile.updated_by = user.id
    await session.commit()
    return serialize(profile)
