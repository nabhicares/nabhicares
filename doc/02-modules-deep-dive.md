# Module Deep Dive

Research/requirements notes for each of the 10 core modules. Use this as the source for functional specs and DB schema design.

---

## Module 1: Appointment Management

**Research areas**
- Patient booking flow, doctor schedules, time-slot generation
- Cancellation policy, rescheduling, walk-ins
- Queue management, token generation
- Emergency appointments, follow-up appointments

**Open questions**
- Can two patients book the same slot? (must be prevented atomically)
- What happens if a doctor is on leave after bookings exist?
- How is "doctor running late" surfaced to the queue?

---

## Module 2: Patient Management

**Research areas**
- Registration, unique patient ID generation
- Family member linkage, medical history, allergies, chronic conditions
- Previous visits, insurance information, emergency contacts

**Open questions**
- Should one account manage multiple family members (dependents)?
- Record retention duration (regulatory-driven)?

---

## Module 3: Doctor Management

**Research areas**
- Doctor profile: qualifications, departments, consultation fees
- Availability, weekly schedule, holidays, leave management
- Experience, languages spoken, online consultation support

**Open questions**
- Can doctors work at multiple branches?
- Can schedules change daily (override the weekly template)?

---

## Module 4: Electronic Medical Records (EMR)

**Research areas**
- Consultation notes, diagnoses, prescriptions
- Vital signs, lab reports, imaging reports
- Visit history, clinical attachments

---

## Module 5: Prescription Management

**Research areas**
- Medicine selection, dosage, frequency, duration, food instructions
- Repeat prescriptions, generic substitutions

**Note:** This module is the direct trigger for Inventory/Pharmacy — design the schema so a prescription line item maps cleanly to a dispensable inventory SKU.

---

## Module 6: Inventory Management

The largest module. Break into sub-domains:

### Medicine Master
- Medicine names, generic names, categories, manufacturers
- Strengths, units, storage requirements

### Stock
- Current quantity, reserved quantity, available quantity
- Batch numbers, expiry dates

### Purchases
- Purchase orders, goods received, supplier invoices, payment status

### Sales
- Dispensing, OTC sales (if applicable), prescription-linked sales, returns

### Analytics
- Fast-moving / slow-moving / dead stock
- Inventory valuation, profit margins, stock turnover
- Reorder recommendations

---

## Module 7: Pharmacy

**Research areas**
- Prescription verification, barcode scanning
- Partial dispensing, medicine substitution rules
- Expiry checking, batch selection
- Billing integration (dispensing must generate a bill line item)

---

## Module 8: Billing

**Research areas**
- Consultation charges, pharmacy bills, lab bills
- Discounts, insurance claims, refunds
- Multiple payment methods, tax handling (GST etc.)

---

## Module 9: Notifications

### Patient notifications
- Appointment reminders, medicine reminders
- Prescription expiry, follow-up reminders
- Lab report availability, payment confirmations

### Doctor notifications
- Upcoming appointments, schedule changes, emergency bookings

### Hospital/Admin notifications
- Low stock, expiring medicines, supplier delays, outstanding payments

---

## Module 10: Reports & Analytics

### Administration
- Revenue, profit, expenses, inventory value
- Daily appointments, doctor utilization, pharmacy performance
- Top diagnoses, patient growth

### Doctor
- Patients seen, consultation history, follow-ups, prescription trends

### Pharmacy
- Sales, purchases, inventory movement
- Expiry losses, returns, supplier performance

---

## Integrations to Plan For

- SMS or WhatsApp for reminders
- Push notifications, email notifications
- Payment gateway
- Cloud storage for reports and prescriptions
- Barcode / QR code support
- PDF generation (prescriptions, bills, reports)
- Calendar synchronization (optional)
- Backup and audit logging
