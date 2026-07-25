# Hospital Management Platform — Product Requirements Overview

## Framing

This is not "a hospital app with inventory bolted on." It is a **Hospital Management Platform**: a set of interconnected modules serving multiple user roles, all sharing one data backbone (patients, doctors, appointments, prescriptions, inventory, billing).

Before writing code, two questions must be answered:

1. What problem are we solving for each user role?
2. How do the modules communicate with each other?

---

## 1. User Roles

### Hospital Administration
- Dashboard, revenue, inventory, employee management, doctor management
- Reports, pharmacy analytics, billing overview
- Patient analytics, appointment analytics, notifications

### Doctors
- Daily appointments, patient history, medical records
- Prescriptions, lab reports, availability schedule
- Leave management, notes, follow-up scheduling

### Receptionist / Front Desk
- Patient registration, appointment booking, queue management
- Billing, check-in/check-out, insurance details, patient search

### Pharmacy Staff
- Medicine search, barcode scanning, dispensing
- Inventory updates, purchase management, supplier management
- Returns, expiry tracking

### Patient
- Login, view/book appointments, view prescriptions
- Medicine reminders, bills, lab reports, doctor details
- Notifications, profile

---

## 2. Module Map (10 Core Modules)

| # | Module | Owner Role(s) |
|---|--------|----------------|
| 1 | Appointment Management | Patient, Receptionist, Doctor |
| 2 | Patient Management | Receptionist, Patient |
| 3 | Doctor Management | Admin |
| 4 | Electronic Medical Records (EMR) | Doctor |
| 5 | Prescription Management | Doctor → feeds Pharmacy |
| 6 | Inventory Management | Pharmacy, Admin |
| 7 | Pharmacy | Pharmacy Staff |
| 8 | Billing | Receptionist, Pharmacy, Admin |
| 9 | Notifications | All roles |
| 10 | Reports & Analytics | Admin, Doctor, Pharmacy |

Full detail on each module is in `02-modules-deep-dive.md`.

---

## 3. Cross-Module Data Flow

```text
Patient
    │
    ▼
Appointment
    │
    ▼
Doctor Consultation
    │
    ├─────────────┐
    ▼             ▼
Prescription    Lab Orders
    │
    ▼
Pharmacy
    │
    ▼
Inventory
    │
    ▼
Billing
    │
    ▼
Reports & Analytics
```

Every module should be designed so it plugs into this pipeline rather than existing as an island. E.g., a prescription is not just a doctor's note — it's the trigger event for pharmacy dispensing, inventory decrement, and a billing line item.

---

## 4. Open Design Questions to Resolve Early

**Appointments**
- Can two patients book the same slot? (No — needs atomic slot locking.)
- What happens if a doctor goes on leave after slots are already booked?
- How is a doctor running late communicated to the queue?

**Patients**
- Does one login manage multiple family members (dependents)?
- Data retention policy for medical records (legal/compliance driven).

**Doctors**
- Can a doctor work across multiple branches/hospitals?
- Can weekly schedules be overridden per-day?

---

## 5. Related Files

- `02-modules-deep-dive.md` — detailed requirements per module
- `03-user-journeys-integrations-nfr.md` — end-to-end journeys, integrations, non-functional requirements, MVP phasing
- `04-wireframes-patient-doctor-apps.md` — screen-by-screen wireframes for Patient & Doctor apps
- `05-wireframes-admin-app-design-system.md` — Admin/Staff app wireframes + design system
- `06-deliverables-checklist.md` — documents to produce before development starts
