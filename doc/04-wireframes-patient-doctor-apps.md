# Wireframe Plan — Patient App & Doctor App

Three role-based experiences are planned in total (Patient, Doctor, Hospital Staff/Admin), covering roughly **90–120 unique screens** combined (see screen-count table in file 05). This file covers the first two.

---

# 1. Patient Mobile Application

## Authentication Flow
```text
Splash
  ↓
Onboarding (3 screens)
  ↓
Login
  ↓
OTP Verification
  ↓
Register
  ↓
Forgot Password
```

## Home Screen
```
┌───────────────────────────────┐
│ Good Morning, [Name]           │
│ Search Doctors                 │
├───────────────────────────────┤
│ Upcoming Appointment           │
├───────────────────────────────┤
│ Quick Actions                  │
│  - Book Appointment            │
│  - My Prescriptions            │
│  - Medicine Reminder           │
│  - Bills                       │
├───────────────────────────────┤
│ Recommended Doctors            │
├───────────────────────────────┤
│ Health Tips                    │
└───────────────────────────────┘
```

## Doctor Listing
- Search bar
- Filters: Department, Availability, Experience, Language, Gender, Sort

**Doctor Card:** Photo, Name, Specialization, Experience, Rating, Next Available Slot, "Book Appointment" CTA

## Doctor Profile
Photo, Qualification, Experience, Hospital, Available Days, Consultation Fee, Languages, Reviews, "Book Appointment" CTA

## Appointment Booking Flow
```text
Choose Hospital → Choose Doctor → Choose Date → Choose Time Slot
→ Patient Details → Payment → Booking Success
```

## My Appointments
Tabs: Upcoming / Completed / Cancelled — with Reschedule and Cancel actions

## Prescription View
Visit Date, Doctor, Medicines, Dosage, Duration, "Download PDF"

## Medicine Reminder
Medicine name, Morning / Afternoon / Night slots, Completed / Skipped states

## Notifications
Appointment Reminder, Medicine Reminder, Hospital Notification, Offers, Lab Reports

## Profile
Personal Details, Family Members, Medical History, Insurance, Settings, Logout

## Bottom Navigation (Patient)
`Home | Appointments | Prescription | Notifications | Profile`

**Approx. screen count: 22**

---

# 2. Doctor Application

## Dashboard
Today's Appointments, Pending Follow-ups, Completed Patients, Revenue, Quick Actions

## Appointment List
Tabs: Upcoming / Current / Completed / Cancelled

## Patient Details
Patient Information, Vitals, History, Previous Visits, Allergies, Reports

## Consultation Screen
Symptoms, Diagnosis, Notes, Attachments

## Prescription Screen
Search Medicine, Dosage, Frequency, Duration, Instructions, Save

## Schedule
Mon–Sun availability grid, Add Slot, Block Time, Leave

## Doctor Profile
Qualification, Certificates, Experience, Availability, Fees

## Bottom Navigation (Doctor)
`Dashboard | Appointments | Patients | Schedule | Profile`

**Approx. screen count: 18**

---

## Design Notes
- Both apps should share the same design system (see file 05) so components (cards, chips, bottom sheets) are reusable across role-based apps if built with one shared codebase + RBAC.
- Booking flow and prescription screen are the two highest-value flows to prototype first — they're the connective tissue to Pharmacy/Inventory/Billing.
