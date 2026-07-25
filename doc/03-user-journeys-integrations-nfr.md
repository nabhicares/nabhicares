# User Journeys, Non-Functional Requirements & MVP Roadmap

## 1. End-to-End User Journeys

### Patient Journey
```text
Register → Login → Search Doctor → View Availability → Book Appointment
→ Receive Confirmation → Visit Doctor → View Prescription
→ Receive Medicine Reminders → Buy Medicines → View Bills → Book Follow-up
```

### Doctor Journey
```text
Login → View Schedule → Consult Patient → Record Notes
→ Create Prescription → Order Tests → Schedule Follow-up
```

### Pharmacy Journey
```text
Receive Prescription → Verify Medicines → Check Inventory
→ Dispense Medicines → Update Stock → Generate Bill
```

### Inventory Journey
```text
Receive Purchase → Add Batch → Update Stock → Monitor Expiry
→ Dispense Medicines → Handle Returns → Generate Reports
```

---

## 2. Non-Functional Requirements

- **Security & access control** — role-based access control (RBAC) enforced at API + DB level
- **Audit trail** — for medicine and record changes (who changed what, when)
- **Performance** — fast search across patients/medicines/appointments
- **Backup & disaster recovery**
- **Offline capability** (if required, e.g. for rural/low-connectivity deployments)
- **Scalability** — support multiple hospital branches
- **Data privacy & encryption** — especially for medical records (PII/PHI)
- **Accessibility & responsive design**

---

## 3. MVP Prioritization

### Phase 1 — Core Hospital Operations
- Authentication and user roles
- Patient management
- Doctor management
- Appointment booking
- Consultation and prescriptions
- Inventory management
- Pharmacy dispensing
- Billing
- Basic dashboards

### Phase 2 — Patient Experience
- Patient mobile app
- Medicine reminders
- Push notifications
- Online payments
- Digital reports
- Doctor availability & booking enhancements

### Phase 3 — Advanced Features
- Multi-branch support
- Telemedicine
- AI-powered inventory forecasting
- Clinical decision support
- Advanced analytics
- Supplier performance scoring

---

## 4. Rationale for Sequencing

Phase 1 exists because nothing else works without patients, doctors, appointments, and the prescription→pharmacy→inventory→billing pipeline functioning end to end. Phase 2 is about surfacing that same data to patients directly (self-service, reminders, payments) rather than adding new backend capability. Phase 3 is where you spend engineering effort on things that create competitive differentiation (forecasting, telemedicine, multi-branch) — worth doing only once the core loop is proven with real users.
