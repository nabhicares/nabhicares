import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, require_hospital, require_roles, scope_session
from ..db import get_session
from ..models import (
    Medicine,
    MedicineBatch,
    PurchaseOrder,
    PurchaseOrderItem,
    Stock,
    StockTransaction,
    Supplier,
)
from ..responses import serialize
from ..schemas import PurchaseCreate, PurchaseReceive

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]
PurchaseStaff = Annotated[
    CurrentUser,
    Depends(require_roles("super_admin", "hospital_admin", "pharmacist")),
]


@router.get("/purchases/suppliers")
async def list_suppliers(
    session: Session, user: PurchaseStaff, limit: int = Query(50, ge=1, le=100)
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    rows = (
        await session.scalars(
            select(Supplier)
            .where(Supplier.hospital_id == hospital_id, Supplier.deleted_at.is_(None))
            .order_by(Supplier.name)
            .limit(limit)
        )
    ).all()
    return [serialize(row) for row in rows]


@router.post("/purchases", status_code=201)
@router.post("/purchases/orders", status_code=201)
async def create_purchase(body: PurchaseCreate, session: Session, user: PurchaseStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    supplier = await session.scalar(
        select(Supplier.id).where(
            Supplier.id == body.supplier_id,
            Supplier.hospital_id == hospital_id,
            Supplier.deleted_at.is_(None),
        )
    )
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    medicine_ids = {item.medicine_id for item in body.items}
    found = set(
        (
            await session.scalars(
                select(Medicine.id).where(
                    Medicine.hospital_id == hospital_id,
                    Medicine.id.in_(medicine_ids),
                    Medicine.deleted_at.is_(None),
                )
            )
        ).all()
    )
    if found != medicine_ids:
        raise HTTPException(404, "One or more medicines were not found")

    total = sum((item.unit_price * item.quantity for item in body.items), Decimal(0))
    order = PurchaseOrder(
        hospital_id=hospital_id,
        supplier_id=body.supplier_id,
        order_number=f"PO-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        status="ordered",
        expected_at=body.expected_at,
        total_amount=total,
        notes=body.notes,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(order)
    await session.flush()
    session.add_all(
        [
            PurchaseOrderItem(
                purchase_order_id=order.id,
                medicine_id=item.medicine_id,
                ordered_quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in body.items
        ]
    )
    await session.commit()
    return serialize(order)


@router.get("/purchases/orders")
@router.get("/purchases/history")
async def purchase_history(
    session: Session,
    user: PurchaseStaff,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = select(PurchaseOrder).where(PurchaseOrder.hospital_id == hospital_id)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    rows = (
        await session.scalars(stmt.order_by(PurchaseOrder.created_at.desc()).limit(limit))
    ).all()
    return [serialize(row) for row in rows]


@router.put("/purchases/orders/{order_id}/receive")
async def receive_purchase(
    order_id: uuid.UUID,
    body: PurchaseReceive,
    session: Session,
    user: PurchaseStaff,
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    order = await session.scalar(
        select(PurchaseOrder)
        .where(
            PurchaseOrder.id == order_id,
            PurchaseOrder.hospital_id == hospital_id,
        )
        .with_for_update()
    )
    if not order:
        raise HTTPException(404, "Purchase order not found")
    if order.status in {"received", "cancelled"}:
        raise HTTPException(409, f"Cannot receive a {order.status} order")

    item_ids = {item.purchase_item_id for item in body.items}
    order_items = (
        await session.scalars(
            select(PurchaseOrderItem)
            .where(
                PurchaseOrderItem.purchase_order_id == order.id,
                PurchaseOrderItem.id.in_(item_ids),
            )
            .order_by(PurchaseOrderItem.id)
            .with_for_update()
        )
    ).all()
    by_id = {item.id: item for item in order_items}
    if set(by_id) != item_ids:
        raise HTTPException(404, "One or more purchase items were not found")

    for received in body.items:
        purchase_item = by_id[received.purchase_item_id]
        if (
            purchase_item.received_quantity + received.quantity_received
            > purchase_item.ordered_quantity
        ):
            raise HTTPException(409, "Received quantity exceeds ordered quantity")
        if received.expiry_date <= datetime.now(UTC).date():
            raise HTTPException(422, "Cannot receive an expired batch")

        batch_id = await session.scalar(
            insert(MedicineBatch)
            .values(
                hospital_id=hospital_id,
                medicine_id=purchase_item.medicine_id,
                supplier_id=order.supplier_id,
                batch_number=received.batch_number,
                manufacturing_date=received.manufacturing_date,
                expiry_date=received.expiry_date,
                purchase_price=purchase_item.unit_price,
                selling_price=received.selling_price,
                created_by=user.id,
                updated_by=user.id,
            )
            .on_conflict_do_update(
                index_elements=[
                    MedicineBatch.hospital_id,
                    MedicineBatch.medicine_id,
                    MedicineBatch.batch_number,
                ],
                set_={
                    "expiry_date": received.expiry_date,
                    "purchase_price": purchase_item.unit_price,
                    "selling_price": received.selling_price,
                    "updated_by": user.id,
                    "updated_at": func.now(),
                },
            )
            .returning(MedicineBatch.id)
        )
        balance = await session.scalar(
            insert(Stock)
            .values(
                medicine_batch_id=batch_id,
                hospital_id=hospital_id,
                available_quantity=received.quantity_received,
                reserved_quantity=0,
                damaged_quantity=0,
                created_by=user.id,
                updated_by=user.id,
            )
            .on_conflict_do_update(
                index_elements=[Stock.medicine_batch_id],
                set_={
                    "available_quantity": Stock.available_quantity + received.quantity_received,
                    "version": Stock.version + 1,
                    "updated_by": user.id,
                    "updated_at": func.now(),
                },
            )
            .returning(Stock.available_quantity)
        )
        purchase_item.received_quantity += received.quantity_received
        session.add(
            StockTransaction(
                hospital_id=hospital_id,
                medicine_batch_id=batch_id,
                transaction_type="purchase",
                quantity_delta=received.quantity_received,
                balance_after=balance,
                reference_type="purchase_order",
                reference_id=order.id,
                performed_by=user.id,
            )
        )

    all_items = (
        await session.scalars(
            select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id)
        )
    ).all()
    order.status = (
        "received"
        if all(item.received_quantity >= item.ordered_quantity for item in all_items)
        else "partial"
    )
    order.updated_by = user.id
    await session.commit()
    return serialize(order)
