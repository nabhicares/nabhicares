import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, require_hospital, require_roles, scope_session
from ..db import get_session
from ..models import (
    CreditLedger,
    Customer,
    Doctor,
    MedicineBatch,
    MedicineSale,
    MedicineSaleItem,
    Payment,
    Stock,
    StockTransaction,
)
from ..responses import serialize
from ..schemas import CustomerInline, SaleCreate

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]
SalesStaff = Annotated[
    CurrentUser,
    Depends(require_roles("super_admin", "hospital_admin", "pharmacist", "receptionist")),
]


@router.get("/customers")
async def list_customers(
    session: Session,
    user: SalesStaff,
    q: str | None = None,
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(Customer).where(
        Customer.hospital_id == hospital_id, Customer.deleted_at.is_(None)
    )
    if q:
        stmt = stmt.where(Customer.name.ilike(f"%{q}%"))
    rows = (await session.scalars(stmt.order_by(Customer.name).limit(limit))).all()
    return [serialize(row) for row in rows]


@router.post("/customers", status_code=201)
async def create_customer(body: CustomerInline, session: Session, user: SalesStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    customer = Customer(
        **body.model_dump(),
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(customer)
    await session.commit()
    return serialize(customer)


@router.patch("/customers/{customer_id}")
async def update_customer(
    customer_id: uuid.UUID,
    body: CustomerInline,
    session: Session,
    user: SalesStaff,
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    customer = await session.scalar(
        select(Customer)
        .where(
            Customer.id == customer_id,
            Customer.hospital_id == hospital_id,
            Customer.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if not customer:
        raise HTTPException(404, "Customer not found")
    for key, value in body.model_dump().items():
        setattr(customer, key, value)
    customer.updated_by = user.id
    await session.commit()
    return serialize(customer)


@router.post("/sales", status_code=201)
async def create_sale(body: SaleCreate, session: Session, user: SalesStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)

    if body.customer_id:
        customer = await session.scalar(
            select(Customer)
            .where(
                Customer.id == body.customer_id,
                Customer.hospital_id == hospital_id,
                Customer.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if not customer:
            raise HTTPException(404, "Customer not found")
    elif body.customer:
        customer = Customer(
            **body.customer.model_dump(),
            hospital_id=hospital_id,
            created_by=user.id,
            updated_by=user.id,
        )
        session.add(customer)
        await session.flush()
    else:
        customer = None

    doctor = None
    if body.doctor_id:
        doctor = await session.scalar(
            select(Doctor)
            .where(
                Doctor.id == body.doctor_id,
                Doctor.hospital_id == hospital_id,
                Doctor.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if not doctor:
            raise HTTPException(404, "Doctor not found")

    requested: dict[uuid.UUID, int] = {}
    for item in body.items:
        requested[item.batch_id] = requested.get(item.batch_id, 0) + item.quantity

    stock_rows = (
        await session.execute(
            select(Stock, MedicineBatch)
            .join(MedicineBatch, MedicineBatch.id == Stock.medicine_batch_id)
            .where(
                Stock.hospital_id == hospital_id,
                Stock.medicine_batch_id.in_(sorted(requested, key=str)),
            )
            .order_by(Stock.medicine_batch_id)
            .with_for_update()
        )
    ).all()
    by_batch = {row.MedicineBatch.id: row for row in stock_rows}
    if set(by_batch) != set(requested):
        raise HTTPException(404, "One or more batches were not found")

    subtotal = Decimal(0)
    tax_amount = Decimal(0)
    line_values = []
    for batch_id, quantity in requested.items():
        row = by_batch[batch_id]
        if row.Stock.available_quantity < quantity:
            raise HTTPException(
                409,
                f"Insufficient stock for batch {row.MedicineBatch.batch_number}",
            )
        if row.MedicineBatch.expiry_date <= datetime.now(UTC).date():
            raise HTTPException(409, f"Batch {row.MedicineBatch.batch_number} is expired")
        line_total = row.MedicineBatch.selling_price * quantity
        subtotal += line_total
        line_values.append((row, quantity, line_total))

    total = subtotal + tax_amount - body.discount_amount
    if total < 0:
        raise HTTPException(422, "discount_amount cannot exceed subtotal")

    sale = MedicineSale(
        hospital_id=hospital_id,
        sale_number=f"SALE-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        customer_id=customer.id if customer else None,
        doctor_id=doctor.id if doctor else None,
        payment_method=body.payment_method,
        upi_transaction_ref=body.upi_transaction_ref,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=body.discount_amount,
        total_amount=total,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(sale)
    await session.flush()

    for row, quantity, line_total in line_values:
        row.Stock.available_quantity -= quantity
        row.Stock.version += 1
        row.Stock.updated_by = user.id
        session.add(
            MedicineSaleItem(
                sale_id=sale.id,
                medicine_batch_id=row.MedicineBatch.id,
                quantity=quantity,
                unit_price=row.MedicineBatch.selling_price,
                line_total=line_total,
            )
        )
        session.add(
            StockTransaction(
                hospital_id=hospital_id,
                medicine_batch_id=row.MedicineBatch.id,
                transaction_type="sale",
                quantity_delta=-quantity,
                balance_after=row.Stock.available_quantity,
                reference_type="sale",
                reference_id=sale.id,
                performed_by=user.id,
            )
        )

    payment = Payment(
        hospital_id=hospital_id,
        sale_id=sale.id,
        payment_method=body.payment_method,
        amount=total,
        transaction_reference=body.upi_transaction_ref,
        status="pending" if body.payment_method == "credit" else "completed",
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(payment)

    credit_ledger_id = None
    if body.payment_method == "credit":
        if not customer:
            raise HTTPException(422, "Credit sale requires a customer")
        prior = await session.scalar(
            select(func.coalesce(func.sum(CreditLedger.amount), 0)).where(
                CreditLedger.hospital_id == hospital_id,
                CreditLedger.doctor_id == (doctor.id if doctor else None),
                CreditLedger.customer_id == customer.id,
                CreditLedger.status == "open",
            )
        )
        ledger = CreditLedger(
            hospital_id=hospital_id,
            doctor_id=doctor.id if doctor else None,
            customer_id=customer.id,
            sale_id=sale.id,
            amount=total,
            balance_after=Decimal(prior) + total,
            created_by=user.id,
            updated_by=user.id,
        )
        session.add(ledger)
        await session.flush()
        credit_ledger_id = ledger.id

    await session.commit()
    result = serialize(sale)
    result["creditLedgerId"] = str(credit_ledger_id) if credit_ledger_id else None
    return result


@router.get("/sales")
async def list_sales(
    session: Session,
    user: SalesStaff,
    customer_id: uuid.UUID | None = None,
    payment_method: str | None = None,
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(MedicineSale).where(MedicineSale.hospital_id == hospital_id)
    if customer_id:
        stmt = stmt.where(MedicineSale.customer_id == customer_id)
    if payment_method:
        stmt = stmt.where(MedicineSale.payment_method == payment_method)
    rows = (await session.scalars(stmt.order_by(MedicineSale.created_at.desc()).limit(limit))).all()
    return [serialize(row) for row in rows]


@router.get("/doctors/{doctor_id}/credits")
async def doctor_credits(
    doctor_id: uuid.UUID,
    session: Session,
    user: SalesStaff,
    limit: int = Query(50, ge=1, le=200),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    rows = (
        await session.scalars(
            select(CreditLedger)
            .where(
                CreditLedger.hospital_id == hospital_id,
                CreditLedger.doctor_id == doctor_id,
            )
            .order_by(CreditLedger.created_at.desc())
            .limit(limit)
        )
    ).all()
    return {
        "entries": [serialize(row) for row in rows],
        "balance": str(sum((row.amount for row in rows if row.status == "open"), Decimal(0))),
    }
