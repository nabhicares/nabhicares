"""Load the demo dataset the portals were built against into the DEMO hospital.

Ported from the original Node seed (backend/src/database/seed.ts) so the identifiers
the web pages hardcode — patient BADP1K3A, doctor 5D4181ZA — still resolve. Legacy
string ids become medical record / registration numbers, and primary keys are derived
from them with uuid5 so the script is idempotent and cross-references stay stable.

Roles and users are deliberately left alone: POST /api/v1/bootstrap creates those and
would fail on a duplicate role name if this script created them first.

Usage: python scripts/seed_demo_data.py
"""

from __future__ import annotations

import os
import re
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import psycopg

NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")
DEMO_CODE = "DEMO"
TODAY = datetime.now(UTC).date()


def key(kind: str, legacy_id: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{legacy_id}")


def day(offset: int) -> date:
    return TODAY + timedelta(days=offset)


def at(on: date, slot: str) -> datetime:
    hour, minute = (int(part) for part in slot.split(":"))
    return datetime(on.year, on.month, on.day, hour, minute, tzinfo=UTC)


DOCTORS = [
    ("5D4181ZA", "Dr. Gregory House", "Diagnostics", "house@pharmastore.com", 1200),
    ("DOC-FOREMAN", "Dr. Eric Foreman", "Neurology", "foreman@pharmastore.com", 1500),
    ("DOC-CAMERON", "Dr. Allison Cameron", "Immunology", "cameron@pharmastore.com", 1000),
]

PATIENTS = [
    ("BADP1K3A", "Alice Patient", "alice@pharmastore.com", "+919800000006", "1992-08-24", "Female"),
    ("PAT-RAVI", "Ravi Kumar", "ravi@pharmastore.com", "+919800000007", "1985-03-12", "Male"),
    ("PAT-PRIYA", "Priya Sharma", "priya@pharmastore.com", "+919800000008", "1998-11-05", "Female"),
    ("PAT-ANIL", "Anil Mehta", "anil@pharmastore.com", "+919800000013", "1974-06-18", "Male"),
    ("PAT-SNEHA", "Sneha Reddy", "sneha@pharmastore.com", "+919800000014", "2001-01-30", "Female"),
]

# sku, name, generic, category, brand, unit, gst, reorder, barcode, quantity, cost, mrp
MEDICINES = [
    ("MED-ASP-100", "Aspirin 100mg", "Aspirin", "Analgesics", "Bayer", "strip", 12, 50, "8901000000001", 200, 8, 25),
    ("MED-PAR-500", "Paracetamol 500mg", "Acetaminophen", "Analgesics", "Crocin", "strip", 12, 100, "8901000000002", 520, 5, 30),
    ("MED-IBU-400", "Ibuprofen 400mg", "Ibuprofen", "NSAIDs", "Brufen", "strip", 12, 30, "8901000000003", 18, 12, 45),
    ("MED-AMO-250", "Amoxicillin 250mg", "Amoxicillin", "Antibiotics", "Novamox", "strip", 18, 40, "8901000000004", 0, 28, 85),
    ("MED-MET-500", "Metformin 500mg", "Metformin", "Antidiabetics", "Glycomet", "strip", 12, 60, "8901000000005", 340, 10, 40),
    ("MED-ATO-10", "Atorvastatin 10mg", "Atorvastatin", "Cardiology", "Atorva", "strip", 12, 40, "8901000000006", 12, 32, 95),
    ("MED-CET-10", "Cetirizine 10mg", "Cetirizine", "Antihistamines", "Okacet", "strip", 12, 50, "8901000000007", 280, 4, 18),
    ("MED-OMZ-20", "Omeprazole 20mg", "Omeprazole", "Gastroenterology", "Omez", "strip", 12, 45, "8901000000008", 190, 14, 55),
    ("MED-AZI-500", "Azithromycin 500mg", "Azithromycin", "Antibiotics", "Azithral", "strip", 18, 25, "8901000000009", 75, 22, 75),
    ("MED-ORS-200", "ORS Sachet", "Oral Rehydration Salts", "Electrolytes", "Electral", "box", 12, 80, "8901000000010", 400, 6, 22),
]

# legacy id, patient, doctor, day offset, slot, status
APPOINTMENTS = [
    ("apt-001", "BADP1K3A", "5D4181ZA", -5, "11:00", "completed"),
    ("apt-002", "BADP1K3A", "5D4181ZA", 0, "09:00", "booked"),
    ("apt-003", "BADP1K3A", "DOC-FOREMAN", 2, "10:30", "booked"),
    ("apt-004", "BADP1K3A", "DOC-CAMERON", -12, "14:00", "completed"),
    ("apt-005", "PAT-RAVI", "5D4181ZA", 0, "09:30", "booked"),
    ("apt-006", "PAT-PRIYA", "5D4181ZA", 0, "10:00", "booked"),
    ("apt-007", "PAT-ANIL", "5D4181ZA", 0, "10:30", "booked"),
    ("apt-008", "PAT-SNEHA", "5D4181ZA", 1, "09:00", "booked"),
    ("apt-009", "PAT-RAVI", "5D4181ZA", -3, "15:00", "completed"),
    ("apt-010", "PAT-PRIYA", "DOC-CAMERON", 1, "11:00", "booked"),
    ("apt-011", "PAT-ANIL", "DOC-FOREMAN", 0, "15:00", "booked"),
    ("apt-012", "PAT-SNEHA", "DOC-CAMERON", -8, "10:00", "cancelled"),
]

# legacy id, patient, doctor, status, [(medicine name, dosage, frequency, days, instructions)]
PRESCRIPTIONS = [
    ("rx-001", "BADP1K3A", "5D4181ZA", "active", [
        ("Paracetamol 500mg", "500mg", "1-0-1", 5, "After food"),
        ("Ibuprofen 400mg", "400mg", "as needed", 3, "Max 3/day"),
    ]),
    ("rx-002", "PAT-RAVI", "5D4181ZA", "active", [
        ("Metformin 500mg", "500mg", "1-0-1", 30, "With meals"),
        ("Atorvastatin 10mg", "10mg", "0-0-1", 30, "At night"),
    ]),
    ("rx-003", "PAT-PRIYA", "DOC-CAMERON", "active", [
        ("Cetirizine 10mg", "10mg", "0-0-1", 7, "At bedtime"),
    ]),
    ("rx-004", "PAT-ANIL", "DOC-FOREMAN", "active", [
        ("Omeprazole 20mg", "20mg", "1-0-0", 14, "Before breakfast"),
        ("Aspirin 100mg", "100mg", "0-0-1", 30, "After dinner"),
    ]),
    ("rx-005", "BADP1K3A", "5D4181ZA", "dispensed", [
        ("Paracetamol 500mg", "500mg", "1-1-1", 3, "After food"),
    ]),
    ("rx-006", "PAT-SNEHA", "DOC-CAMERON", "active", [
        ("Cetirizine 10mg", "10mg", "0-0-1", 5, "At night"),
        ("ORS Sachet", "21.8g", "1 sachet", 2, "Dissolve in water"),
    ]),
]

# invoice number, patient, status, [(description, amount)]
INVOICES = [
    ("INV-001", "BADP1K3A", "paid", [("Consultation — Diagnostics", 1200), ("Lab: CBC panel", 450)]),
    ("INV-002", "BADP1K3A", "unpaid", [("Consultation — Immunology", 1000)]),
    ("INV-003", "PAT-RAVI", "paid", [("Consultation — Diagnostics", 1200), ("Pharmacy dispense", 380)]),
    ("INV-004", "PAT-PRIYA", "paid", [("Pharmacy dispense — Cetirizine", 90)]),
    ("INV-005", "PAT-ANIL", "unpaid", [("Consultation — Neurology", 1500), ("MRI screening fee", 3500)]),
    ("INV-006", "PAT-SNEHA", "paid", [("Pharmacy dispense — Allergy pack", 160)]),
]

SUPPLIERS = [
    ("PharmaCorp Distributors", "orders@pharmacorp.in", "+919999900001", "36AAAAA0000A1Z5"),
    ("MediLife Wholesale", "sales@medilife.in", "+919999900002", "29BBBBB1111B2Z6"),
]

# order number, supplier, status, day offset, [(medicine sku, qty, unit price, received)]
PURCHASE_ORDERS = [
    ("PO-101", "PharmaCorp Distributors", "pending", 0, [
        ("MED-ASP-100", 200, 8, 0), ("MED-PAR-500", 300, 5, 0),
    ]),
    ("PO-102", "MediLife Wholesale", "pending", -1, [
        ("MED-AMO-250", 150, 28, 0), ("MED-ATO-10", 100, 32, 0),
    ]),
    ("PO-103", "PharmaCorp Distributors", "received", -7, [
        ("MED-MET-500", 250, 10, 250),
    ]),
]


def load_env() -> str:
    for name in (".env", ".env.database"):
        path = Path(name)
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            field, value = line.split("=", 1)
            os.environ.setdefault(field.strip(), value.strip().strip("\"'"))
    url = os.environ.get("DATABASE_MIGRATION_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_MIGRATION_URL or DATABASE_URL must be set")
    # The app talks to Postgres through SQLAlchemy's driver-qualified URL; psycopg needs it bare.
    return re.sub(r"^postgresql\+psycopg://", "postgresql://", url)


def seed(cur: psycopg.Cursor) -> uuid.UUID:
    cur.execute(
        "select id from hospital.hospitals where code = %s and deleted_at is null", (DEMO_CODE,)
    )
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"Hospital {DEMO_CODE!r} is missing — run scripts/seed_demo_hospital.py")
    hospital = row[0]

    for registration, name, specialization, email, fee in DOCTORS:
        cur.execute(
            """
            insert into doctor.doctors
              (id, hospital_id, name, specialization, registration_number, email,
               consultation_fee, commission_rate, status)
            values (%s, %s, %s, %s, %s, %s, %s, 0, 'active')
            on conflict (hospital_id, registration_number) do update
              set name = excluded.name,
                  specialization = excluded.specialization,
                  consultation_fee = excluded.consultation_fee
            """,
            (key("doctor", registration), hospital, name, specialization, registration, email, fee),
        )

    for mrn, name, email, phone, dob, gender in PATIENTS:
        cur.execute(
            """
            insert into patient.patients
              (id, hospital_id, medical_record_number, name, date_of_birth, gender, phone, email,
               status)
            values (%s, %s, %s, %s, %s, %s, %s, %s, 'active')
            on conflict (hospital_id, medical_record_number) do update
              set name = excluded.name, phone = excluded.phone, email = excluded.email
            """,
            (key("patient", mrn), hospital, mrn, name, dob, gender, phone, email),
        )

    for category in sorted({entry[3] for entry in MEDICINES}):
        cur.execute(
            """
            insert into inventory.medicine_categories (id, hospital_id, name)
            values (%s, %s, %s)
            on conflict (hospital_id, name) do nothing
            """,
            (key("category", category), hospital, category),
        )

    for sku, name, generic, category, brand, unit, gst, reorder, barcode, qty, cost, mrp in MEDICINES:
        cur.execute(
            """
            insert into inventory.medicines
              (id, hospital_id, category_id, sku, barcode, name, generic_name, manufacturer, unit,
               gst_rate, reorder_level, status)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            on conflict (hospital_id, sku) do update
              set name = excluded.name,
                  category_id = excluded.category_id,
                  reorder_level = excluded.reorder_level
            """,
            (
                key("medicine", sku), hospital, key("category", category), sku, barcode, name,
                generic, brand, unit, gst, reorder,
            ),
        )
        if qty <= 0:
            continue
        # Aspirin keeps a near-expiry batch so the expiry report has something to show.
        batches = [("BATCH-A", qty, date(2028, 12, 31))]
        if sku == "MED-ASP-100":
            batches = [("BATCH-A", qty - 30, date(2028, 12, 31)), ("BATCH-EXPIRING", 30, day(12))]
        for batch_number, batch_qty, expiry in batches:
            batch_id = key("batch", f"{sku}:{batch_number}")
            cur.execute(
                """
                insert into inventory.medicine_batches
                  (id, hospital_id, medicine_id, batch_number, expiry_date, purchase_price,
                   selling_price)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (hospital_id, medicine_id, batch_number) do update
                  set expiry_date = excluded.expiry_date, selling_price = excluded.selling_price
                """,
                (batch_id, hospital, key("medicine", sku), batch_number, expiry, cost, mrp),
            )
            cur.execute(
                """
                insert into inventory.stock
                  (medicine_batch_id, hospital_id, available_quantity, reserved_quantity,
                   damaged_quantity, version)
                values (%s, %s, %s, 0, 0, 1)
                on conflict (medicine_batch_id) do update
                  set available_quantity = excluded.available_quantity
                """,
                (batch_id, hospital, batch_qty),
            )

    for legacy, mrn, registration, offset, slot, status in APPOINTMENTS:
        starts = at(day(offset), slot)
        cur.execute(
            """
            insert into appointment.appointments
              (id, hospital_id, patient_id, doctor_id, starts_at, ends_at, status)
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update
              set starts_at = excluded.starts_at, status = excluded.status
            """,
            (
                key("appointment", legacy), hospital, key("patient", mrn),
                key("doctor", registration), starts, starts + timedelta(minutes=30), status,
            ),
        )

    for legacy, mrn, registration, status, items in PRESCRIPTIONS:
        rx_id = key("prescription", legacy)
        cur.execute(
            """
            insert into prescription.prescriptions
              (id, hospital_id, patient_id, doctor_id, status)
            values (%s, %s, %s, %s, %s)
            on conflict (id) do update set status = excluded.status
            """,
            (rx_id, hospital, key("patient", mrn), key("doctor", registration), status),
        )
        for index, (medicine, dosage, frequency, days, instructions) in enumerate(items):
            cur.execute(
                """
                insert into prescription.prescription_items
                  (id, prescription_id, medicine_name, dosage, frequency, duration_days,
                   quantity, instructions)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update
                  set dosage = excluded.dosage, frequency = excluded.frequency
                """,
                (
                    key("rx_item", f"{legacy}:{index}"), rx_id, medicine, dosage, frequency,
                    days, days, instructions,
                ),
            )

    for number, mrn, status, items in INVOICES:
        total = sum(amount for _, amount in items)
        cur.execute(
            """
            insert into billing.invoices
              (id, hospital_id, invoice_number, patient_id, subtotal, tax_amount, discount_amount,
               total_amount, paid_amount, status)
            values (%s, %s, %s, %s, %s, 0, 0, %s, %s, %s)
            on conflict (hospital_id, invoice_number) do update
              set total_amount = excluded.total_amount,
                  paid_amount = excluded.paid_amount,
                  status = excluded.status
            """,
            (
                key("invoice", number), hospital, number, key("patient", mrn), total, total,
                total if status == "paid" else 0, status,
            ),
        )
        for index, (description, amount) in enumerate(items):
            cur.execute(
                """
                insert into billing.invoice_items
                  (id, invoice_id, item_type, description, quantity, unit_price, tax_amount,
                   discount_amount, total_amount)
                values (%s, %s, 'service', %s, 1, %s, 0, 0, %s)
                on conflict (id) do update set description = excluded.description
                """,
                (
                    key("invoice_item", f"{number}:{index}"), key("invoice", number),
                    description, amount, amount,
                ),
            )

    for name, email, phone, gstin in SUPPLIERS:
        cur.execute(
            """
            insert into supplier.suppliers (id, hospital_id, name, gstin, phone, email, status)
            values (%s, %s, %s, %s, %s, %s, 'active')
            on conflict (hospital_id, name) do update set phone = excluded.phone
            """,
            (key("supplier", name), hospital, name, gstin, phone, email),
        )

    for number, supplier, status, offset, items in PURCHASE_ORDERS:
        total = sum(qty * price for _, qty, price, _ in items)
        cur.execute(
            """
            insert into supplier.purchase_orders
              (id, hospital_id, supplier_id, order_number, status, expected_at, total_amount)
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (hospital_id, order_number) do update
              set status = excluded.status, total_amount = excluded.total_amount
            """,
            (
                key("purchase", number), hospital, key("supplier", supplier), number, status,
                day(offset + 7), total,
            ),
        )
        for sku, qty, price, received in items:
            cur.execute(
                """
                insert into supplier.purchase_order_items
                  (id, purchase_order_id, medicine_id, ordered_quantity, received_quantity,
                   unit_price)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update
                  set ordered_quantity = excluded.ordered_quantity,
                      received_quantity = excluded.received_quantity
                """,
                (
                    key("po_item", f"{number}:{sku}"), key("purchase", number),
                    key("medicine", sku), qty, received, price,
                ),
            )

    return hospital


def main() -> int:
    url = load_env()
    with psycopg.connect(url) as connection, connection.cursor() as cur:
        # The runtime role is blocked by row-level security; seeding needs the admin role.
        cur.execute("select set_config('app.is_super_admin', 'true', true)")
        hospital = seed(cur)
        connection.commit()

        print(f"Seeded demo data into hospital {hospital}")
        for table in (
            "doctor.doctors",
            "patient.patients",
            "inventory.medicines",
            "inventory.medicine_batches",
            "appointment.appointments",
            "prescription.prescriptions",
            "billing.invoices",
            "supplier.suppliers",
            "supplier.purchase_orders",
        ):
            cur.execute(f"select count(*) from {table}")
            print(f"  {table}: {cur.fetchone()[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
