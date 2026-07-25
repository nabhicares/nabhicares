# Technical Architecture & Stack

This is a production-grade Hospital Management System (HMS), not a simple CRUD app — API-driven backend serving a Flutter mobile client, built to scale to multi-hospital, AI features, and analytics without a rewrite.

**Update:** Backend is now **Node.js (TypeScript, NestJS)** on top of **Firebase** (Firestore + Firebase Auth + Firebase Storage + FCM), replacing the earlier FastAPI/PostgreSQL stack. Assumption: standalone Node.js API server using the Firebase Admin SDK, deployed on Cloud Run (or similar), rather than pure Cloud Functions — flag it if you actually want a fully serverless Cloud Functions backend instead, the module boundaries stay the same either way.

---

## High-Level Architecture

```text
                    Flutter Mobile App
                           │
                    HTTPS REST API
                           │
                  Firebase Auth (ID token verification)
                           │
                   Node.js (NestJS) Backend
                           │
        ┌──────────────┬──────────────┬──────────────┐
        │              │              │              │
 Appointment     Patient        Inventory      Billing
 Service         Service         Service        Service
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                           │
                    Cloud Firestore (NoSQL)
                           │
                     Firebase Storage
                           │
              Firebase Cloud Messaging (FCM)
```

---

## Mobile Stack — Flutter

| Concern | Choice |
|---|---|
| Framework | Flutter (latest stable) |
| State management | Riverpod |
| Routing | go_router |
| Networking | Dio |
| JSON serialization | json_serializable + freezed |
| Local storage | Hive; flutter_secure_storage (tokens) |
| Dependency injection | get_it |
| Form validation | reactive_forms |
| Charts | fl_chart |
| Calendar | table_calendar |
| Barcode | mobile_scanner |
| PDF | pdf + printing |
| Image picker | image_picker |
| Camera | camera |
| Auth | firebase_auth (Flutter SDK) |
| Notifications | firebase_messaging + flutter_local_notifications |

---

## Backend Stack — Node.js (NestJS) + Firebase

**Why NestJS over plain Express:** gives you the same structural discipline FastAPI provided in Python — modules, dependency injection, decorators, guards for RBAC, and built-in OpenAPI/Swagger docs via `@nestjs/swagger`. TypeScript end-to-end also means request/response types can be shared conceptually with the Flutter side's model definitions (via generated OpenAPI client or manually mirrored DTOs).

| Concern | Choice |
|---|---|
| Language | TypeScript |
| Framework | NestJS |
| Database | Cloud Firestore (NoSQL, document/collection model) |
| Auth | Firebase Authentication (email/password, phone OTP built-in) |
| File storage | Firebase Storage |
| Push notifications | Firebase Cloud Messaging |
| Validation | class-validator + class-transformer (NestJS DTOs) |
| API docs | @nestjs/swagger (OpenAPI) |
| Background jobs | Cloud Functions (scheduled/Pub-Sub triggers) or @nestjs/schedule (cron) on the server |
| Admin SDK | firebase-admin (server-side Firestore/Auth/Storage/FCM access) |

### API Structure
```text
/api/v1
  /auth
  /users
  /patients
  /doctors
  /appointments
  /prescriptions
  /pharmacy
  /inventory
  /medicines
  /suppliers
  /purchases
  /billing
  /reports
  /notifications
  /settings
```

### Backend Folder Structure (NestJS, feature-module style)
```text
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/           # global exception filter (error envelope)
│   │   ├── interceptors/      # response envelope, logging
│   │   ├── guards/            # FirebaseAuthGuard, RolesGuard
│   │   ├── decorators/        # @Roles(), @CurrentUser()
│   │   └── dto/                # shared/pagination DTOs
│   ├── config/
│   │   └── firebase.config.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── patients/
│   │   ├── doctors/
│   │   ├── appointments/
│   │   ├── consultations/
│   │   ├── prescriptions/
│   │   ├── pharmacy/
│   │   ├── inventory/
│   │   ├── purchases/
│   │   ├── billing/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── settings/
│   │       # each module: controller.ts, service.ts, repository.ts,
│   │       #              dto/, entities (Firestore doc interfaces)
│   └── database/
│       └── firestore.service.ts  # thin wrapper around firebase-admin Firestore client
└── test/
    ├── unit/
    └── e2e/
```

---

## Data Model — Cloud Firestore (replaces PostgreSQL tables)

Firestore is a NoSQL document store, so the "tables" from the previous plan become **top-level collections**, with sub-collections where data is naturally nested per-parent (e.g. a patient's medical history).

| Domain | Firestore Collections |
|---|---|
| Users/Auth | `users` (profile + role, mirrors Firebase Auth UID), `roles`, `permissions` |
| Hospital | `hospitals`, `departments`, `branches` |
| Doctors | `doctors`, `doctors/{id}/availability`, `doctors/{id}/leave` |
| Patients | `patients`, `patients/{id}/familyMembers`, `patients/{id}/medicalHistory`, `patients/{id}/allergies` |
| Appointments | `appointments`, `appointmentSlots` |
| Consultation | `consultations`, `consultations/{id}/notes` |
| Prescription | `prescriptions`, `prescriptions/{id}/items` |
| Pharmacy | `medicineSales`, `medicineSales/{id}/items`, `medicineReturns` |
| Inventory | `medicines`, `medicines/{id}/batches`, `stock`, `stockTransactions`, `stockAdjustments`, `stockAlerts` |
| Purchases | `suppliers`, `purchaseOrders`, `purchaseOrders/{id}/items`, `purchasePayments` |
| Billing | `invoices`, `invoices/{id}/items`, `payments`, `refunds` |
| Reports | `dailyReports`, `monthlyReports` (precomputed/aggregated, written by scheduled jobs) |
| Notifications | `notifications`, `notificationLogs` |
| Settings | `settings`, `systemConfiguration` |

### Key Firestore design differences vs. PostgreSQL

- **No JOINs.** Denormalize where reads matter (e.g. store `doctorName` directly on an `appointment` doc, not just `doctorId`) to avoid N+1 reads.
- **No foreign key constraints.** Referential integrity must be enforced in the NestJS service layer, not the database.
- **Transactions & batched writes** (Firestore `runTransaction`) are required anywhere multiple documents must update atomically — the most important case is inventory: decrementing `stock` and writing a `stockTransactions` record must happen in one transaction.
- **Composite indexes** must be explicitly defined (`firestore.indexes.json`) for any query that filters/sorts on multiple fields — plan these per-screen query pattern, not per-table like SQL indexes.
- **Stock transaction ledger stays the audit backbone**, same principle as before:
  ```text
  medicines → medicines/{id}/batches → stock → stockTransactions → medicineSales → medicineReturns → reports
  ```
  Every stock movement is still written to `stockTransactions` — nothing mutates `stock` quantities without a corresponding transaction doc, enforced inside a Firestore transaction in the inventory service.

---

## File/Object Storage

**Firebase Storage** for doctor profile images, patient reports, prescriptions (PDF), bills (PDF), medicine images. Access controlled via Firebase Storage security rules keyed off the same custom claims used for RBAC.

---

## Authentication & RBAC — Firebase Auth

- Client (Flutter) signs in via `firebase_auth` (email/password, or phone OTP — Firebase Auth has this built in, so a separate custom OTP flow is no longer needed).
- Client sends the Firebase **ID token** on each request (`Authorization: Bearer <idToken>`).
- NestJS backend verifies the ID token server-side via `firebase-admin` (`getAuth().verifyIdToken()`) — no custom JWT issuing/refresh logic to maintain; Firebase handles token refresh client-side automatically.
- **RBAC via Firebase custom claims:** role (`super_admin | hospital_admin | doctor | receptionist | pharmacist | patient`) is set as a custom claim on the Firebase Auth user (set server-side via Admin SDK, e.g. on user creation/role change). A NestJS `RolesGuard` reads the decoded claim from the verified token — permission checks stay server-side, same as before.

---

## Notifications

- **Push:** Firebase Cloud Messaging — appointment reminders, medicine reminders, prescription ready, inventory alerts (unchanged, now the native/only notification provider instead of one option among several).
- **Local notifications:** flutter_local_notifications, used when the app already knows the schedule (e.g. daily medicine reminder) — no server round-trip needed.

---

## Third-Party Integrations

| Purpose | Options |
|---|---|
| Maps | Google Maps (hospital location, navigation) |
| Payments | Razorpay (India) / Stripe (global) |
| SMS/OTP | Firebase Auth phone sign-in covers OTP natively; MSG91/Twilio only needed for non-auth SMS (e.g. appointment SMS alerts) |
| Email | Resend / SendGrid |
| PDF generation | Bills, prescriptions, purchase orders (e.g. `pdfkit` on the Node side) |
| Barcode | Generate medicine labels; scan for billing & inventory updates (Flutter: mobile_scanner) |

---

## Analytics

Dashboard data is aggregated server-side, not computed on-device — precomputed into `dailyReports`/`monthlyReports` collections by scheduled Cloud Functions or a NestJS cron job, since Firestore aggregation queries are limited compared to SQL.

```text
GET /api/v1/reports/dashboard
Returns: Today's Sales, Inventory Value, Low Stock,
         Fast-Moving Medicines, Appointments, Revenue, Profit
```

---

## Logging & Monitoring (from day one)
- Structured application logs (e.g. `pino` or `nestjs-pino`)
- Error tracking (Sentry — has a Node SDK)
- API request logs
- Audit logs for sensitive actions (inventory, billing, prescriptions) — written to a dedicated `auditLogs` Firestore collection

---

## Deployment

- **Backend:** Docker image running the NestJS app, deployed to **Cloud Run** (pairs naturally with Firebase/GCP, scales to zero, no server management) or any container host. Firebase project holds Firestore/Auth/Storage/FCM regardless of where the API container runs.
- **Mobile:** Android + iOS via Flutter, using `firebase_core` + `firebase_auth` + `firebase_messaging` Flutter plugins configured against the same Firebase project.

---

## Architecture Principles

- **Clean/modular architecture** on both Flutter and NestJS (controller → service → repository layering)
- **Feature-based modules** (appointments, inventory, billing, pharmacy...) rather than grouping by file type
- **Repository pattern** for Firestore access — keeps business logic independent of the specific Firestore SDK calls, and makes it easier to swap/extend storage later if needed
- **RBAC enforced server-side** via NestJS guards reading Firebase custom claims — never trust client-side role checks alone
- **Firestore transactions** for any multi-document atomic update (inventory being the critical case)
- **Versioned APIs** (`/api/v1`)
- **Comprehensive audit logging** for inventory, billing, prescription actions
- **Background task processing** via scheduled Cloud Functions or NestJS `@nestjs/schedule`, for notifications, reminders, and report generation

---

## Project Structure Summary

```text
Hospital Management System
├── Flutter Mobile App
│   ├── Patient Module
│   ├── Doctor Module
│   ├── Admin Module
│   ├── Pharmacy Module
│   └── Inventory Module
├── Node.js (NestJS) Backend
│   ├── Auth (Firebase Auth verification + RBAC)
│   ├── Patient APIs
│   ├── Doctor APIs
│   ├── Appointment APIs
│   ├── Inventory APIs
│   ├── Billing APIs
│   ├── Reports APIs
│   └── Notifications APIs
├── Cloud Firestore
├── Firebase Authentication
├── Firebase Storage
├── Firebase Cloud Messaging
└── Monitoring & Logging (Sentry, structured logs)
```
