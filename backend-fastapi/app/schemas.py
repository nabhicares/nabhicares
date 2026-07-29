import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    medical_record_number: str = Field(min_length=1, max_length=60)
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    blood_group: str | None = Field(default=None, max_length=8)
    address: str | None = None


class DoctorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    specialization: str | None = Field(default=None, max_length=120)
    registration_number: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    consultation_fee: Decimal = Field(default=0, ge=0)
    commission_rate: Decimal = Field(default=0, ge=0, le=100)


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def valid_range(self):
        if self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(booked|confirmed|checked_in|consultation|completed|cancelled)$")
    note: str | None = None


class MedicineCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    barcode: str | None = Field(default=None, max_length=100)
    name: str = Field(min_length=2, max_length=200)
    generic_name: str | None = None
    manufacturer: str | None = None
    unit: str = "unit"
    gst_rate: Decimal = Field(default=0, ge=0, le=100)
    reorder_level: int = Field(default=0, ge=0)


class StockAdd(BaseModel):
    medicine_id: uuid.UUID
    batch_number: str = Field(min_length=1, max_length=100)
    quantity: int = Field(gt=0)
    expiry_date: date
    manufacturing_date: date | None = None
    purchase_price: Decimal = Field(ge=0)
    selling_price: Decimal = Field(ge=0)
    supplier_id: uuid.UUID | None = None
    reference_id: uuid.UUID | None = None
    note: str | None = None


class CustomerInline(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None


class SaleItemCreate(BaseModel):
    batch_id: uuid.UUID
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    customer: CustomerInline | None = None
    doctor_id: uuid.UUID | None = None
    items: list[SaleItemCreate] = Field(min_length=1)
    payment_method: str = Field(pattern="^(cash|upi|card|credit|bank_transfer|insurance)$")
    upi_transaction_ref: str | None = None
    discount_amount: Decimal = Field(default=0, ge=0)

    @model_validator(mode="after")
    def valid_payment(self):
        if self.customer_id and self.customer:
            raise ValueError("Provide customer_id or customer, not both")
        if self.payment_method == "upi" and not self.upi_transaction_ref:
            raise ValueError("upi_transaction_ref is required for UPI")
        return self


class PurchaseItemCreate(BaseModel):
    medicine_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class PurchaseCreate(BaseModel):
    supplier_id: uuid.UUID
    items: list[PurchaseItemCreate] = Field(min_length=1)
    expected_at: date | None = None
    notes: str | None = None


class ReceiveItem(BaseModel):
    purchase_item_id: uuid.UUID
    batch_number: str
    quantity_received: int = Field(gt=0)
    expiry_date: date
    manufacturing_date: date | None = None
    selling_price: Decimal = Field(ge=0)


class PurchaseReceive(BaseModel):
    items: list[ReceiveItem] = Field(min_length=1)


class DocumentMetadataCreate(BaseModel):
    owner_type: str = Field(pattern="^(patient|doctor|hospital|medicine|supplier|invoice)$")
    owner_id: uuid.UUID
    document_type: str = Field(min_length=1, max_length=60)
    cloudinary_public_id: str = Field(min_length=1, max_length=255)
    secure_url: str
    mime_type: str | None = None
    file_size: int | None = Field(default=None, ge=0)


class PaymentCreate(BaseModel):
    invoice_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    payment_method: str = Field(pattern="^(cash|upi|card|credit|bank_transfer|insurance)$")
    transaction_reference: str | None = Field(default=None, max_length=160)

    @model_validator(mode="after")
    def valid_reference(self):
        if self.payment_method == "upi" and not self.transaction_reference:
            raise ValueError("transaction_reference is required for UPI")
        return self


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None
    logo_url: str | None = None
    signature_url: str | None = None
    gstin: str | None = Field(default=None, max_length=30)


class DeviceTokenCreate(BaseModel):
    token: str = Field(min_length=20)
    platform: str = Field(pattern="^(android|ios|web)$")


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    payload: dict[str, str] = Field(default_factory=dict)


class BootstrapRequest(BaseModel):
    hospital_name: str = Field(min_length=2, max_length=200)
    hospital_code: str = Field(min_length=2, max_length=40)
    firebase_uid: str = Field(min_length=4, max_length=128)
    email: str | None = None
    display_name: str | None = None
