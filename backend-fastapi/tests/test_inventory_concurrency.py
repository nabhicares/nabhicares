import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest

database_url = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not database_url, reason="TEST_DATABASE_URL is not set")

os.environ.setdefault("DATABASE_URL", database_url or "postgresql://u:p@localhost/db")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test")
os.environ.setdefault("FIREBASE_CLIENT_EMAIL", "test@example.invalid")
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "test")
os.environ.setdefault("CLOUDINARY_URL", "cloudinary://key:secret@cloud")
os.environ.setdefault("BOOTSTRAP_SECRET", "12345678901234567890123456789012")

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select, text

from app.auth import CurrentUser, get_current_user
from app.db import SessionLocal
from app.main import app
from app.models import (
    Customer,
    Hospital,
    Medicine,
    MedicineBatch,
    MedicineSale,
    MedicineSaleItem,
    Payment,
    Stock,
    StockTransaction,
)


def as_pharmacist(hospital_id: uuid.UUID):
    """Stand in for a verified Firebase caller.

    The app has no auth bypass to borrow, so the test overrides the dependency
    instead — the routers under test are what we want to exercise anyway.
    """
    return lambda: CurrentUser(
        id=None,
        firebase_uid="test-pharmacist",
        role="pharmacist",
        hospital_id=hospital_id,
        email="pharmacist@test.invalid",
    )


@pytest.mark.asyncio
async def test_concurrent_sales_cannot_oversell():
    hospital_id = uuid.uuid4()
    medicine_id = uuid.uuid4()
    async with SessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_super_admin', 'true', true)"))
        session.add(Hospital(id=hospital_id, code=f"T-{hospital_id.hex[:8]}", name="Test"))
        session.add(
            Medicine(
                id=medicine_id,
                hospital_id=hospital_id,
                sku=f"SKU-{medicine_id.hex[:8]}",
                name="Concurrency Test",
            )
        )
        await session.commit()

    app.dependency_overrides[get_current_user] = as_pharmacist(hospital_id)
    headers = {"Authorization": "Bearer test"}
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            stock = await client.post(
                "/api/v1/stock/add",
                headers=headers,
                json={
                    "medicine_id": str(medicine_id),
                    "batch_number": "CONCURRENT-1",
                    "quantity": 5,
                    "expiry_date": str(datetime.now(UTC).date() + timedelta(days=365)),
                    "purchase_price": "10",
                    "selling_price": "20",
                },
            )
            assert stock.status_code == 201, stock.text
            batch_id = stock.json()["data"]["medicineBatchId"]

            customer = await client.post(
                "/api/v1/customers",
                headers=headers,
                json={"name": "Concurrency Customer"},
            )
            assert customer.status_code == 201, customer.text
            customer_id = customer.json()["data"]["id"]

            payload = {
                "customer_id": customer_id,
                "items": [{"batch_id": batch_id, "quantity": 4}],
                "payment_method": "cash",
            }
            first, second = await asyncio.gather(
                client.post("/api/v1/sales", headers=headers, json=payload),
                client.post("/api/v1/sales", headers=headers, json=payload),
            )
            assert sorted((first.status_code, second.status_code)) == [201, 409]
    finally:
        app.dependency_overrides.clear()
        async with SessionLocal() as session:
            await session.execute(text("SELECT set_config('app.is_super_admin', 'true', true)"))
            sale_ids = list(
                (
                    await session.scalars(
                        select(MedicineSale.id).where(MedicineSale.hospital_id == hospital_id)
                    )
                ).all()
            )
            if sale_ids:
                await session.execute(delete(Payment).where(Payment.sale_id.in_(sale_ids)))
                await session.execute(
                    delete(MedicineSaleItem).where(MedicineSaleItem.sale_id.in_(sale_ids))
                )
            await session.execute(
                delete(StockTransaction).where(StockTransaction.hospital_id == hospital_id)
            )
            await session.execute(
                delete(MedicineSale).where(MedicineSale.hospital_id == hospital_id)
            )
            await session.execute(delete(Customer).where(Customer.hospital_id == hospital_id))
            await session.execute(delete(Stock).where(Stock.hospital_id == hospital_id))
            await session.execute(
                delete(MedicineBatch).where(MedicineBatch.hospital_id == hospital_id)
            )
            await session.execute(delete(Medicine).where(Medicine.hospital_id == hospital_id))
            await session.execute(delete(Hospital).where(Hospital.id == hospital_id))
            await session.commit()


@pytest.mark.asyncio
async def test_rls_hides_other_hospital_rows():
    first_hospital, second_hospital = uuid.uuid4(), uuid.uuid4()
    first_medicine, second_medicine = uuid.uuid4(), uuid.uuid4()
    async with SessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_super_admin', 'true', true)"))
        session.add_all(
            [
                Hospital(id=first_hospital, code=f"A-{first_hospital.hex[:8]}", name="A"),
                Hospital(id=second_hospital, code=f"B-{second_hospital.hex[:8]}", name="B"),
                Medicine(
                    id=first_medicine,
                    hospital_id=first_hospital,
                    sku=f"A-{first_medicine.hex[:8]}",
                    name="Hospital A Medicine",
                ),
                Medicine(
                    id=second_medicine,
                    hospital_id=second_hospital,
                    sku=f"B-{second_medicine.hex[:8]}",
                    name="Hospital B Medicine",
                ),
            ]
        )
        await session.commit()

    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT set_config('app.is_super_admin', 'false', true)"))
            await session.execute(
                text("SELECT set_config('app.hospital_id', :value, true)"),
                {"value": str(first_hospital)},
            )
            visible = set((await session.scalars(select(Medicine.id))).all())
            assert first_medicine in visible
            assert second_medicine not in visible
    finally:
        async with SessionLocal() as session:
            await session.execute(text("SELECT set_config('app.is_super_admin', 'true', true)"))
            await session.execute(
                delete(Medicine).where(Medicine.hospital_id.in_((first_hospital, second_hospital)))
            )
            await session.execute(
                delete(Hospital).where(Hospital.id.in_((first_hospital, second_hospital)))
            )
            await session.commit()
