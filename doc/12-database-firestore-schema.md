# Volume 2: Firestore Database Schema Specification

This document details the schema definitions for all collections and sub-collections of the Hospital Management Platform database. These schemas are modeled as standard document properties and types in Firestore.

---

## 1. System Settings Collection

Stores hospital-wide settings parameters.

### Collection Path: `/settings`
- **Document Key**: `systemConfiguration`
- **Fields**:
  - `hospitalName`: `string` (e.g. `"Pharma Store General Hospital"`)
  - `taxPercentage`: `number` (e.g. `18`)
  - `lowStockThreshold`: `number` (e.g. `15`)
  - `updatedAt`: `string` (ISO Timestamp)

---

## 2. Access Registry (Users) Collection

Maintains user profile metadata mapping to custom security claims.

### Collection Path: `/users`
- **Document Key**: `uid` (Firebase Authentication User UID)
- **Fields**:
  - `uid`: `string`
  - `name`: `string`
  - `email`: `string`
  - `phone`: `string`
  - `role`: `string` (`super_admin` | `hospital_admin` | `doctor` | `pharmacist` | `receptionist` | `patient`)
  - `status`: `string` (`active` | `inactive`)
  - `createdAt`: `string` (ISO Timestamp)

---

## 3. Patient Profiles Collection

Demographic and medical background records for clinical registration.

### Collection Path: `/patients`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `uid`: `string` (Firebase auth reference)
  - `name`: `string`
  - `email`: `string`
  - `phone`: `string`
  - `dateOfBirth`: `string` (YYYY-MM-DD)
  - `gender`: `string` (`Male` | `Female` | `Other`)
  - `allergies`: `array[string]` (e.g. `["Penicillin"]`)
  - `medicalHistory`: `array[string]` (e.g. `["Asthma"]`)
  - `createdAt`: `string` (ISO Timestamp)

---

## 4. Doctor Profiles Collection

Consulting fees, credentials, and weekly slots parameters.

### Collection Path: `/doctors`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `uid`: `string` (Firebase auth reference)
  - `name`: `string`
  - `email`: `string`
  - `specialty`: `string`
  - `consultationFee`: `number`
  - `qualifications`: `string` (e.g. `"MD, FACP"`)
  - `weeklySchedule`: `map` (Key: Weekday e.g., `"Monday"`, Value: `array[string]` slots e.g. `["09:00-12:00"]`)
  - `createdAt`: `string` (ISO Timestamp)

---

## 5. Doctor Appointments Collection

Reserved doctor consultation dates and times.

### Collection Path: `/appointments`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `patientId`: `string` (Patient ID reference)
  - `patientName`: `string`
  - `doctorId`: `string` (Doctor ID reference)
  - `doctorName`: `string`
  - `date`: `string` (YYYY-MM-DD)
  - `timeSlot`: `string` (HH:MM)
  - `status`: `string` (`booked` | `completed` | `cancelled`)
  - `createdAt`: `string` (ISO Timestamp)

---

## 6. EMR Consultations Collection

Clinical checkups logged by consulting doctors.

### Collection Path: `/consultations`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `appointmentId`: `string` (Appointment ID reference)
  - `patientId`: `string` (Patient ID reference)
  - `doctorId`: `string` (Doctor UID reference)
  - `symptoms`: `string`
  - `diagnosis`: `string`
  - `vitals`: `map`
    - `bloodPressure`: `string`
    - `temperatureCelsius`: `string`
    - `heartRateBpm`: `string`
    - `weightKg`: `string`
  - `clinicalNotes`: `string` (Optional)
  - `createdAt`: `string` (ISO Timestamp)

---

## 7. Prescription Orders Collection

Itemized pharmaceutical list prescribed by doctors.

### Collection Path: `/prescriptions`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `consultationId`: `string` (Consultation ID reference)
  - `patientId`: `string` (Patient ID reference)
  - `doctorId`: `string` (Doctor UID reference)
  - `items`: `array[map]`
    - `medicineId`: `string`
    - `medicineName`: `string`
    - `dosage`: `string` (e.g. `"1-0-1"`)
    - `duration`: `string` (e.g. `"5 days"`)
    - `instructions`: `string`
    - `status`: `string` (`pending` | `dispensed`)
  - `status`: `string` (`pending` | `partial` | `dispensed`)
  - `createdAt`: `string` (ISO Timestamp)

---

## 8. Inventory & Medicines Collection

Medical SKU master logs and sub-collection batch records.

### Collection Path: `/medicines`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `name`: `string` (e.g. `"Aspirin 100mg"`)
  - `genericName`: `string`
  - `category`: `string`
  - `reorderLevel`: `number` (Reorder alert threshold)
  - `totalQuantity`: `number` (Aggregated stock sum)
  - `createdAt`: `string` (ISO Timestamp)

### Sub-collection Path: `/medicines/{medicineId}/batches`
- **Document Key**: `batchNo` (e.g. `"BATCH-INITIAL-01"`)
- **Fields**:
  - `batchNo`: `string`
  - `expiryDate`: `string` (YYYY-MM-DD)
  - `quantity`: `number` (Batch specific stock)
  - `unitPrice`: `number` (Unit pricing)
  - `updatedAt`: `string` (ISO Timestamp)

---

## 9. Stock Transactions Collection

Auditable tracking ledger of stock receipts and dispensations.

### Collection Path: `/stockTransactions`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `medicineId`: `string`
  - `medicineName`: `string`
  - `batchNo`: `string`
  - `type`: `string` (`purchase` | `adjustment` | `sale`)
  - `quantityChange`: `number` (Negative for deductions, positive for receipts)
  - `reason`: `string` (e.g. `"prescription_dispensation"`, `"purchase_order_receipt"`)
  - `userId`: `string` (Admin UID mapping for overrides/adjustments)
  - `createdAt`: `string` (ISO Timestamp)

---

## 10. Invoices Collection

Billing invoices for hospital appointments and pharmacy checkouts.

### Collection Path: `/invoices`
- **Document Key**: `id` (Auto-generated UUID)
- **Fields**:
  - `id`: `string`
  - `patientId`: `string`
  - `patientName`: `string`
  - `appointmentId`: `string` (Optional)
  - `items`: `array[map]`
    - `description`: `string`
    - `amount`: `number`
  - `totalAmount`: `number`
  - `status`: `string` (`unpaid` | `paid` | `refunded`)
  - `createdAt`: `string` (ISO Timestamp)
