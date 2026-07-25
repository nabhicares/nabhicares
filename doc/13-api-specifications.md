# Volume 3: REST API Specifications

All backend endpoints are prefixed with `/api/v1/`. The standard response format wraps results in a metadata envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "ISO_String", "requestId": "String" }
}
```

---

## 1. Authentication & Users Module

Authenticated via HTTP Header: `Authorization: Bearer <Firebase_ID_Token>`

### Register User Profile
- **Path**: `POST /users/register`
- **Permissions**: Authenticated patients
- **Request Body**:
  ```json
  {
    "name": "Alice Patient",
    "email": "alice@hospital.com",
    "phone": "+12345"
  }
  ```
- **Response**: `201 Created`

### Assign Role Claims
- **Path**: `POST /users/assign-role`
- **Permissions**: `super_admin` | `hospital_admin`
- **Request Body**:
  ```json
  {
    "uid": "mock-doctor-abc",
    "role": "doctor"
  }
  ```
- **Response**: `201 Created`

### Get My Profile
- **Path**: `GET /users/me`
- **Permissions**: Authenticated users
- **Response**: `200 OK` (Returns current user properties)

---

## 2. Patients Module

### Create Patient File
- **Path**: `POST /patients`
- **Permissions**: `receptionist` | `hospital_admin` | `super_admin`
- **Request Body**:
  ```json
  {
    "name": "Bob Patient",
    "email": "bob@hospital.com",
    "phone": "+54321",
    "dateOfBirth": "1980-05-15",
    "gender": "Male",
    "allergies": [],
    "medicalHistory": []
  }
  ```

---

## 3. Doctors Module

### Create Doctor Registry
- **Path**: `POST /doctors`
- **Permissions**: `hospital_admin` | `super_admin`
- **Request Body**:
  ```json
  {
    "name": "Dr. Gregory House",
    "email": "house@hospital.com",
    "specialty": "Diagnostics",
    "consultationFee": 150
  }
  ```

### Set Consultation Schedule
- **Path**: `PUT /doctors/:id/schedule`
- **Permissions**: Doctor owner | Admin
- **Request Body**:
  ```json
  {
    "weeklySchedule": {
      "Monday": ["09:00-12:00", "14:00-17:00"]
    }
  }
  ```

---

## 4. Appointments Module

### Book Slot
- **Path**: `POST /appointments`
- **Permissions**: Patient | Receptionist | Admin
- **Request Body**:
  ```json
  {
    "patientId": "BADP1K3A",
    "doctorId": "5D4181ZA",
    "date": "2026-08-01",
    "timeSlot": "10:00"
  }
  ```
- **Response**: `201 Created` (Throws `409 Conflict` if the slot is occupied)

---

## 5. EMR & Consultations Module

### Log Consultation
- **Path**: `POST /emr/consultations`
- **Permissions**: Doctor | Admin
- **Request Body**:
  ```json
  {
    "appointmentId": "745GA46J",
    "patientId": "BADP1K3A",
    "symptoms": "Headache and fever",
    "diagnosis": "Influenza",
    "vitals": {
      "bloodPressure": "120/80",
      "temperatureCelsius": "38.2",
      "heartRateBpm": "88",
      "weightKg": "75"
    },
    "clinicalNotes": "Advised rest."
  }
  ```

---

## 6. Prescriptions Module

### Issue Prescription
- **Path**: `POST /prescriptions`
- **Permissions**: Doctor | Admin
- **Request Body**:
  ```json
  {
    "consultationId": "VPYVECA6",
    "patientId": "BADP1K3A",
    "items": [
      {
        "medicineId": "EQRINNYY",
        "medicineName": "Aspirin 100mg",
        "dosage": "1-0-1",
        "duration": "5 days",
        "instructions": "Take after food"
      }
    ]
  }
  ```

---

## 7. Inventory Module

### Register Medicine
- **Path**: `POST /inventory/medicines`
- **Permissions**: Pharmacist | Admin
- **Request Body**:
  ```json
  {
    "name": "Aspirin 100mg",
    "genericName": "Aspirin",
    "category": "Analgesic",
    "reorderLevel": 50
  }
  ```

### Add Stock Batch
- **Path**: `POST /inventory/medicines/:id/batch`
- **Permissions**: Pharmacist | Admin
- **Request Body**:
  ```json
  {
    "batchNo": "B-ASP-01",
    "expiryDate": "2029-01-01",
    "quantity": 200,
    "unitPrice": 0.50
  }
  ```

---

## 8. Pharmacy Module

### Dispense Prescription
- **Path**: `POST /pharmacy/dispense`
- **Permissions**: Pharmacist | Admin
- **Request Body**:
  ```json
  {
    "prescriptionId": "FYCQOCK7",
    "items": [
      {
        "medicineId": "EQRINNYY",
        "batchNo": "B-ASP-01",
        "quantity": 10
      }
    ]
  }
  ```
- **Response**: `201 Created` (Coordinates transactional stock deduction and invoice generation)

---

## 9. Billing Module

### Generate Invoice
- **Path**: `POST /billing/invoices`
- **Permissions**: Receptionist | Admin
- **Request Body**:
  ```json
  {
    "patientId": "BADP1K3A",
    "items": [
      {
        "description": "Consultation Fee",
        "amount": 150
      }
    ]
  }
  ```

### Pay Invoice
- **Path**: `POST /billing/invoices/:id/pay?amount=150&method=Cash`
- **Permissions**: Receptionist | Admin

---

## 10. System Settings & Reports

### Get System Configurations
- **Path**: `GET /settings`
- **Permissions**: Authenticated roles

### Retrieve Analytics Dashboard Indicators
- **Path**: `GET /reports/dashboard`
- **Permissions**: `hospital_admin` | `super_admin`
- **Response Data**:
  ```json
  {
    "appointmentsCount": 1,
    "totalStockItems": 190,
    "lowStockItemsCount": 0,
    "totalRevenue": 0,
    "fastMovingMedicines": ["Aspirin 100mg"]
  }
  ```
