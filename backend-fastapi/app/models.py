import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class AuditMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Hospital(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "hospitals"
    __table_args__ = (UniqueConstraint("code"), {"schema": "hospital"})

    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(Text)
    signature_url: Mapped[str | None] = mapped_column(Text)
    gstin: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)


class Branch(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "branches"
    __table_args__ = (
        UniqueConstraint("hospital_id", "code"),
        {"schema": "hospital"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="active")


class Department(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("hospital_id", "name"),
        {"schema": "hospital"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital.branches.id"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")


class Room(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("branch_id", "number"),
        {"schema": "hospital"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospital.branches.id"), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital.departments.id"))
    number: Mapped[str] = mapped_column(String(30), nullable=False)
    room_type: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="available")


class Role(Base, IdMixin, AuditMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("name"), {"schema": "auth"})

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class Permission(Base, IdMixin):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("code"), {"schema": "auth"})

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": "auth"}

    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("auth.roles.id"), primary_key=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auth.permissions.id"), primary_key=True
    )


class User(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("firebase_uid"),
        Index("ix_auth_users_hospital_role", "hospital_id", "role_id"),
        {"schema": "auth"},
    )

    firebase_uid: Mapped[str] = mapped_column(String(128), nullable=False)
    hospital_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("hospital.hospitals.id"), index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("auth.roles.id"), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeviceToken(Base, IdMixin, AuditMixin):
    __tablename__ = "device_tokens"
    __table_args__ = (
        UniqueConstraint("token"),
        Index("ix_device_tokens_user", "hospital_id", "user_id", "active"),
        {"schema": "auth"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auth.users.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str] = mapped_column(String(30), nullable=False)
    active: Mapped[bool] = mapped_column(default=True)


class Doctor(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "doctors"
    __table_args__ = (
        UniqueConstraint("hospital_id", "registration_number"),
        Index("ix_doctor_hospital_name", "hospital_id", "name"),
        {"schema": "doctor"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("auth.users.id"), unique=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital.departments.id"))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    specialization: Mapped[str | None] = mapped_column(String(120))
    registration_number: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    consultation_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")


class DoctorSchedule(Base, IdMixin, AuditMixin):
    __tablename__ = "doctor_schedules"
    __table_args__ = (
        UniqueConstraint("doctor_id", "branch_id", "weekday", "start_time"),
        {"schema": "doctor"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("doctor.doctors.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital.branches.id"))
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    slot_minutes: Mapped[int] = mapped_column(Integer, default=15)


class DoctorLeave(Base, IdMixin, AuditMixin):
    __tablename__ = "doctor_leaves"
    __table_args__ = {"schema": "doctor"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("doctor.doctors.id"), nullable=False, index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)


class Patient(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "patients"
    __table_args__ = (
        UniqueConstraint("hospital_id", "medical_record_number"),
        Index("ix_patient_hospital_phone", "hospital_id", "phone"),
        Index("ix_patient_hospital_name", "hospital_id", "name"),
        {"schema": "patient"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("auth.users.id"))
    medical_record_number: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(30))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    blood_group: Mapped[str | None] = mapped_column(String(8))
    address: Mapped[str | None] = mapped_column(Text)
    profile_image_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")


class PatientEmergencyContact(Base, IdMixin, AuditMixin):
    __tablename__ = "patient_emergency_contacts"
    __table_args__ = {"schema": "patient"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient.patients.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    relationship: Mapped[str | None] = mapped_column(String(60))
    phone: Mapped[str] = mapped_column(String(30))


class PatientClinicalRecord(Base, IdMixin, AuditMixin):
    __tablename__ = "patient_clinical_records"
    __table_args__ = (
        Index("ix_patient_clinical_type", "patient_id", "record_type"),
        {"schema": "patient"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient.patients.id"), nullable=False, index=True
    )
    record_type: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Document(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_patient_documents_owner", "hospital_id", "owner_type", "owner_id"),
        {"schema": "patient"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    owner_type: Mapped[str] = mapped_column(String(40), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_type: Mapped[str] = mapped_column(String(60), nullable=False)
    cloudinary_public_id: Mapped[str] = mapped_column(String(255), nullable=False)
    secure_url: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    file_size: Mapped[int | None] = mapped_column(BigInteger)


class Appointment(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointment_doctor_time", "hospital_id", "doctor_id", "starts_at"),
        Index("ix_appointment_patient_time", "hospital_id", "patient_id", "starts_at"),
        {"schema": "appointment"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital.branches.id"))
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patient.patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctor.doctors.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="booked", index=True)
    reason: Mapped[str | None] = mapped_column(Text)


class AppointmentStatusLog(Base, IdMixin):
    __tablename__ = "appointment_status_logs"
    __table_args__ = {"schema": "appointment"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointment.appointments.id"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("auth.users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[str | None] = mapped_column(Text)


class Consultation(Base, IdMixin, AuditMixin):
    __tablename__ = "consultations"
    __table_args__ = (
        UniqueConstraint("appointment_id"),
        {"schema": "consultation"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointment.appointments.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient.patients.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("doctor.doctors.id"), nullable=False, index=True
    )
    clinical_notes: Mapped[str | None] = mapped_column(Text)
    diagnosis: Mapped[list] = mapped_column(JSONB, default=list)
    vitals: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="open")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Prescription(Base, IdMixin, AuditMixin):
    __tablename__ = "prescriptions"
    __table_args__ = {"schema": "prescription"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    consultation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("consultation.consultations.id")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("patient.patients.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("doctor.doctors.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(30), default="active")
    notes: Mapped[str | None] = mapped_column(Text)


class PrescriptionItem(Base, IdMixin):
    __tablename__ = "prescription_items"
    __table_args__ = {"schema": "prescription"}

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("prescription.prescriptions.id"), nullable=False, index=True
    )
    medicine_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    duration_days: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[int | None] = mapped_column(Integer)
    instructions: Mapped[str | None] = mapped_column(Text)


class Supplier(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("hospital_id", "name"),
        {"schema": "supplier"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(30))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")


class MedicineCategory(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "medicine_categories"
    __table_args__ = (
        UniqueConstraint("hospital_id", "name"),
        {"schema": "inventory"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class Medicine(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "medicines"
    __table_args__ = (
        UniqueConstraint("hospital_id", "sku"),
        UniqueConstraint("hospital_id", "barcode"),
        Index("ix_inventory_medicine_name", "hospital_id", "name"),
        {"schema": "inventory"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inventory.medicine_categories.id")
    )
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(200))
    manufacturer: Mapped[str | None] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(40), default="unit")
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")


class MedicineBatch(Base, IdMixin, AuditMixin):
    __tablename__ = "medicine_batches"
    __table_args__ = (
        UniqueConstraint("hospital_id", "medicine_id", "batch_number"),
        Index("ix_batch_expiry", "hospital_id", "expiry_date"),
        {"schema": "inventory"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory.medicines.id"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("supplier.suppliers.id"))
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    manufacturing_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class Stock(Base, AuditMixin):
    __tablename__ = "stock"
    __table_args__ = (
        CheckConstraint("available_quantity >= 0"),
        CheckConstraint("reserved_quantity >= 0"),
        CheckConstraint("damaged_quantity >= 0"),
        {"schema": "inventory"},
    )

    medicine_batch_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory.medicine_batches.id"), primary_key=True
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    available_quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0)
    damaged_quantity: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)


class StockTransaction(Base, IdMixin):
    __tablename__ = "stock_transactions"
    __table_args__ = (
        Index("ix_stock_tx_batch_time", "medicine_batch_id", "occurred_at"),
        Index("ix_stock_tx_reference", "hospital_id", "reference_type", "reference_id"),
        CheckConstraint("quantity_delta <> 0"),
        {"schema": "inventory"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    medicine_batch_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory.medicine_batches.id"), nullable=False
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(40))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    performed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("auth.users.id"))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)


class PurchaseOrder(Base, IdMixin, AuditMixin):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("hospital_id", "order_number"),
        Index("ix_purchase_status", "hospital_id", "status", "created_at"),
        {"schema": "supplier"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("supplier.suppliers.id"), nullable=False
    )
    order_number: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    expected_at: Mapped[date | None] = mapped_column(Date)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text)


class PurchaseOrderItem(Base, IdMixin):
    __tablename__ = "purchase_order_items"
    __table_args__ = {"schema": "supplier"}

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("supplier.purchase_orders.id"), nullable=False, index=True
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory.medicines.id"), nullable=False
    )
    ordered_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class Customer(Base, IdMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customer_hospital_phone", "hospital_id", "phone"),
        {"schema": "pharmacy"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("patient.patients.id"))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)


class MedicineSale(Base, IdMixin, AuditMixin):
    __tablename__ = "medicine_sales"
    __table_args__ = (
        UniqueConstraint("hospital_id", "sale_number"),
        Index("ix_sale_hospital_time", "hospital_id", "created_at"),
        {"schema": "pharmacy"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    sale_number: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pharmacy.customers.id"))
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("doctor.doctors.id"))
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    upi_transaction_ref: Mapped[str | None] = mapped_column(String(160))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="completed")


class MedicineSaleItem(Base, IdMixin):
    __tablename__ = "medicine_sale_items"
    __table_args__ = {"schema": "pharmacy"}

    sale_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pharmacy.medicine_sales.id"), nullable=False, index=True
    )
    medicine_batch_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("inventory.medicine_batches.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class CreditLedger(Base, IdMixin, AuditMixin):
    __tablename__ = "credit_ledger"
    __table_args__ = (
        Index("ix_credit_doctor_time", "hospital_id", "doctor_id", "created_at"),
        {"schema": "payment"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("doctor.doctors.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pharmacy.customers.id"))
    sale_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pharmacy.medicine_sales.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(30), default="charge")
    status: Mapped[str] = mapped_column(String(30), default="open")


class Invoice(Base, IdMixin, AuditMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("hospital_id", "invoice_number"),
        UniqueConstraint("hospital_id", "sale_id", name="uq_invoices_hospital_sale"),
        Index("ix_invoice_patient_time", "hospital_id", "patient_id", "created_at"),
        {"schema": "billing"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(80), nullable=False)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("patient.patients.id"))
    sale_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pharmacy.medicine_sales.id"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="unpaid")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pdf_url: Mapped[str | None] = mapped_column(Text)


class InvoiceItem(Base, IdMixin):
    __tablename__ = "invoice_items"
    __table_args__ = {"schema": "billing"}

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing.invoices.id"), nullable=False, index=True
    )
    item_type: Mapped[str] = mapped_column(String(40), nullable=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class Payment(Base, IdMixin, AuditMixin):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("hospital_id", "transaction_reference"),
        Index("ix_payment_invoice_time", "invoice_id", "created_at"),
        {"schema": "payment"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("billing.invoices.id"))
    sale_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pharmacy.medicine_sales.id"))
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    transaction_reference: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default="completed")
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Refund(Base, IdMixin, AuditMixin):
    __tablename__ = "refunds"
    __table_args__ = {"schema": "payment"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment.payments.id"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="pending")


class Notification(Base, IdMixin, AuditMixin):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notification_user_time", "user_id", "created_at"),
        {"schema": "notification"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("auth.users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(String(30), default="push")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationLog(Base, IdMixin):
    __tablename__ = "notification_logs"
    __table_args__ = {"schema": "notification"}

    notification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notification.notifications.id"), nullable=False, index=True
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    error: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base, IdMixin):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_hospital_time", "hospital_id", "occurred_at"),
        Index("ix_audit_entity", "hospital_id", "entity_type", "entity_id"),
        {"schema": "audit"},
    )

    hospital_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("hospital.hospitals.id"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("auth.users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_value: Mapped[dict | None] = mapped_column(JSONB)
    new_value: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DailySalesSummary(Base):
    __tablename__ = "daily_sales_summary"
    __table_args__ = (
        UniqueConstraint(
            "hospital_id", "summary_date", name="uq_daily_sales_summary_hospital_date"
        ),
        {"schema": "analytics"},
    )

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), primary_key=True
    )
    summary_date: Mapped[date] = mapped_column(Date, primary_key=True)
    sale_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class InventorySummary(Base):
    __tablename__ = "inventory_summary"
    __table_args__ = {"schema": "analytics"}

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hospital.hospitals.id"), primary_key=True
    )
    total_skus: Mapped[int] = mapped_column(Integer, default=0)
    total_units: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_count: Mapped[int] = mapped_column(Integer, default=0)
    out_of_stock_count: Mapped[int] = mapped_column(Integer, default=0)
    expiring_count: Mapped[int] = mapped_column(Integer, default=0)
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
