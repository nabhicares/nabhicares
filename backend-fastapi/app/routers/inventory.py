from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, require_hospital, require_roles, scope_session
from ..db import get_session
from ..models import Medicine, MedicineBatch, MedicineCategory, Stock, StockTransaction
from ..responses import serialize
from ..schemas import MedicineCreate, StockAdd

router = APIRouter()
Session = Annotated[AsyncSession, Depends(get_session)]
User = Annotated[CurrentUser, Depends(get_current_user)]
StockStaff = Annotated[
    CurrentUser,
    Depends(require_roles("super_admin", "hospital_admin", "pharmacist")),
]


@router.get("/inventory/medicines")
async def list_medicines(
    session: Session,
    user: User,
    q: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    stmt = (
        select(
            Medicine,
            func.coalesce(func.sum(Stock.available_quantity), 0).label("total_quantity"),
            func.max(MedicineBatch.selling_price).label("mrp"),
            MedicineCategory.name.label("category"),
        )
        .outerjoin(MedicineBatch, MedicineBatch.medicine_id == Medicine.id)
        .outerjoin(Stock, Stock.medicine_batch_id == MedicineBatch.id)
        .outerjoin(MedicineCategory, MedicineCategory.id == Medicine.category_id)
        .where(Medicine.hospital_id == hospital_id, Medicine.deleted_at.is_(None))
        .group_by(Medicine.id, MedicineCategory.name)
    )
    if q:
        stmt = stmt.where(Medicine.name.ilike(f"%{q}%"))
    rows = (
        await session.execute(stmt.order_by(Medicine.name).offset((page - 1) * limit).limit(limit))
    ).all()
    return [
        {
            **serialize(row.Medicine),
            "totalQuantity": row.total_quantity,
            "category": row.category,
            "mrp": float(row.mrp) if row.mrp is not None else None,
        }
        for row in rows
    ]


@router.post("/inventory/medicines", status_code=201)
async def create_medicine(body: MedicineCreate, session: Session, user: StockStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    medicine = Medicine(
        **body.model_dump(),
        hospital_id=hospital_id,
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(medicine)
    await session.commit()
    return serialize(medicine)


@router.get("/inventory/summary")
async def inventory_summary(session: Session, user: User):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    per_medicine = (
        select(
            Medicine.id.label("medicine_id"),
            Medicine.reorder_level,
            func.coalesce(func.sum(Stock.available_quantity), 0).label("quantity"),
        )
        .outerjoin(MedicineBatch, MedicineBatch.medicine_id == Medicine.id)
        .outerjoin(Stock, Stock.medicine_batch_id == MedicineBatch.id)
        .where(Medicine.hospital_id == hospital_id, Medicine.deleted_at.is_(None))
        .group_by(Medicine.id)
        .subquery()
    )
    row = (
        await session.execute(
            select(
                func.count(per_medicine.c.medicine_id).label("total_skus"),
                func.coalesce(func.sum(per_medicine.c.quantity), 0).label("total_units"),
                func.count()
                .filter(
                    (per_medicine.c.quantity > 0)
                    & (per_medicine.c.quantity <= per_medicine.c.reorder_level)
                )
                .label("low_stock"),
                func.count().filter(per_medicine.c.quantity == 0).label("out_of_stock"),
            )
        )
    ).one()
    return {
        "totalSKUs": row.total_skus,
        "totalUnits": row.total_units,
        "lowStockCount": row.low_stock,
        "outOfStockCount": row.out_of_stock,
    }


@router.get("/inventory/expiry-list")
@router.get("/expiry-list")
async def expiry_list(
    session: Session,
    user: StockStaff,
    threshold_days: int = Query(30, alias="thresholdDays", ge=0, le=730),
):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    cutoff = datetime.now(UTC).date() + timedelta(days=threshold_days)
    rows = (
        await session.execute(
            select(MedicineBatch, Medicine.name, Stock.available_quantity)
            .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
            .join(Stock, Stock.medicine_batch_id == MedicineBatch.id)
            .where(
                MedicineBatch.hospital_id == hospital_id,
                MedicineBatch.expiry_date <= cutoff,
                Stock.available_quantity > 0,
            )
            .order_by(MedicineBatch.expiry_date)
        )
    ).all()
    return [
        {
            **serialize(row.MedicineBatch),
            "medicineName": row.name,
            "quantityRemaining": row.available_quantity,
        }
        for row in rows
    ]


@router.post("/stock/add", status_code=201)
async def add_stock(body: StockAdd, session: Session, user: StockStaff):
    hospital_id = require_hospital(user)
    if body.expiry_date <= datetime.now(UTC).date():
        raise HTTPException(422, "expiry_date must be in the future")
    await scope_session(session, user)

    medicine_exists = await session.scalar(
        select(Medicine.id).where(
            Medicine.id == body.medicine_id,
            Medicine.hospital_id == hospital_id,
            Medicine.deleted_at.is_(None),
        )
    )
    if not medicine_exists:
        raise HTTPException(404, "Medicine not found")

    batch_id = await session.scalar(
        insert(MedicineBatch)
        .values(
            hospital_id=hospital_id,
            medicine_id=body.medicine_id,
            supplier_id=body.supplier_id,
            batch_number=body.batch_number,
            manufacturing_date=body.manufacturing_date,
            expiry_date=body.expiry_date,
            purchase_price=body.purchase_price,
            selling_price=body.selling_price,
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
                "expiry_date": body.expiry_date,
                "purchase_price": body.purchase_price,
                "selling_price": body.selling_price,
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
            available_quantity=body.quantity,
            reserved_quantity=0,
            damaged_quantity=0,
            created_by=user.id,
            updated_by=user.id,
        )
        .on_conflict_do_update(
            index_elements=[Stock.medicine_batch_id],
            set_={
                "available_quantity": Stock.available_quantity + body.quantity,
                "version": Stock.version + 1,
                "updated_by": user.id,
                "updated_at": func.now(),
            },
        )
        .returning(Stock.available_quantity)
    )
    movement = StockTransaction(
        hospital_id=hospital_id,
        medicine_batch_id=batch_id,
        transaction_type="manual_add",
        quantity_delta=body.quantity,
        balance_after=balance,
        reference_type="manual",
        reference_id=body.reference_id,
        performed_by=user.id,
        note=body.note,
    )
    session.add(movement)
    await session.commit()
    return serialize(movement)


@router.get("/stock/batches/{batch_number}")
async def batch_details(batch_number: str, session: Session, user: StockStaff):
    hospital_id = require_hospital(user)
    await scope_session(session, user)
    batches = (
        await session.execute(
            select(MedicineBatch, Medicine.name, Stock.available_quantity)
            .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
            .outerjoin(Stock, Stock.medicine_batch_id == MedicineBatch.id)
            .where(
                MedicineBatch.hospital_id == hospital_id,
                MedicineBatch.batch_number == batch_number,
            )
        )
    ).all()
    if not batches:
        raise HTTPException(404, "Batch not found")

    result = []
    for row in batches:
        movements = (
            await session.scalars(
                select(StockTransaction)
                .where(StockTransaction.medicine_batch_id == row.MedicineBatch.id)
                .order_by(StockTransaction.occurred_at)
            )
        ).all()
        result.append(
            {
                **serialize(row.MedicineBatch),
                "medicineName": row.name,
                "quantityRemaining": row.available_quantity or 0,
                "transactions": [serialize(tx) for tx in movements],
            }
        )
    return result[0] if len(result) == 1 else result
