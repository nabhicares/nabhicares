# Flutter App Architecture

Proper project structure for the three role-based experiences (Patient, Doctor, Hospital Staff/Admin) as **one Flutter codebase with RBAC-driven navigation**, not three separate apps — this avoids duplicating shared widgets, auth, and networking code. Built with the stack already locked in `07-technical-architecture-stack.md` (Riverpod, go_router, Dio, Firebase Auth).

---

## 1. Project Folder Structure (feature-first, Clean Architecture)

```text
lib/
├── main.dart
├── app.dart                          # MaterialApp.router setup
│
├── core/
│   ├── router/
│   │   ├── app_router.dart           # go_router config, role-based redirect
│   │   └── route_names.dart
│   ├── theme/
│   │   ├── app_colors.dart           # Medical Blue #2563EB, success/warning/critical
│   │   ├── app_typography.dart       # Inter / SF Pro
│   │   └── app_theme.dart
│   ├── network/
│   │   ├── dio_client.dart           # base Dio instance, interceptors
│   │   ├── auth_interceptor.dart     # attaches Firebase ID token
│   │   └── api_exception.dart        # maps backend error envelope
│   ├── di/
│   │   └── providers.dart            # get_it + Riverpod provider wiring
│   ├── storage/
│   │   ├── secure_storage.dart       # flutter_secure_storage wrapper
│   │   └── local_cache.dart          # Hive boxes
│   └── widgets/                      # shared components across all 3 apps
│       ├── app_button.dart
│       ├── app_card.dart
│       ├── app_bottom_sheet.dart
│       ├── empty_state.dart
│       └── loading_indicator.dart
│
├── features/
│   ├── auth/
│   │   ├── data/                     # repository impl, DTOs
│   │   ├── domain/                   # entities, repository interface
│   │   └── presentation/
│   │       ├── screens/              # login, otp, register, forgot_password
│   │       ├── widgets/
│   │       └── providers/            # Riverpod state notifiers
│   │
│   ├── patient_app/
│   │   ├── home/
│   │   ├── doctor_search/
│   │   ├── appointment_booking/
│   │   ├── my_appointments/
│   │   ├── prescriptions/
│   │   ├── medicine_reminders/
│   │   ├── bills/
│   │   ├── notifications/
│   │   └── profile/
│   │
│   ├── doctor_app/
│   │   ├── dashboard/
│   │   ├── appointment_list/
│   │   ├── patient_details/
│   │   ├── consultation/
│   │   ├── prescription_writer/
│   │   ├── schedule/
│   │   └── profile/
│   │
│   └── admin_app/
│       ├── dashboard/
│       ├── patient_management/
│       ├── appointment_management/
│       ├── doctor_management/
│       ├── pharmacy/
│       ├── inventory/
│       │   ├── medicine_list/
│       │   ├── medicine_details/
│       │   ├── add_medicine/
│       │   ├── purchases/
│       │   └── suppliers/
│       ├── billing/
│       ├── reports/
│       ├── analytics/
│       ├── notifications/
│       └── settings/
│
└── shared_models/                    # cross-feature entities (User, Patient, Medicine...)
```

Each feature follows the same 3-layer internal shape: `data/` (repository implementation talking to Dio/Firebase), `domain/` (pure entities + repository interface), `presentation/` (screens, widgets, Riverpod providers). This mirrors the Clean Architecture layering already used on the backend, so the pattern is consistent across the whole stack.

---

## 2. Routing — go_router with Role-Based Redirect

Single router, single app shell — the visible navigation (bottom nav, available routes) is driven by the authenticated user's role claim, not by shipping three separate binaries.

```text
/splash
/onboarding
/login
/otp-verify
/register
/forgot-password

# Patient app routes
/patient/home
/patient/doctors
/patient/doctors/:doctorId
/patient/booking/:doctorId
/patient/appointments
/patient/prescriptions
/patient/reminders
/patient/bills
/patient/notifications
/patient/profile

# Doctor app routes
/doctor/dashboard
/doctor/appointments
/doctor/patients/:patientId
/doctor/consultation/:appointmentId
/doctor/prescription/:consultationId
/doctor/schedule
/doctor/profile

# Admin/Staff app routes
/admin/dashboard
/admin/patients
/admin/appointments
/admin/doctors
/admin/pharmacy
/admin/inventory
/admin/inventory/medicine/:medicineId
/admin/inventory/add-medicine
/admin/purchases
/admin/suppliers
/admin/billing
/admin/reports
/admin/analytics
/admin/notifications
/admin/settings
```

### Redirect logic (illustrative)
```dart
GoRouter(
  redirect: (context, state) {
    final authState = ref.read(authStateProvider);
    if (!authState.isAuthenticated) return '/login';

    final role = authState.user.role; // from Firebase custom claim
    final path = state.matchedLocation;

    if (path.startsWith('/patient') && role != 'patient') return '/unauthorized';
    if (path.startsWith('/doctor') && role != 'doctor') return '/unauthorized';
    if (path.startsWith('/admin') &&
        !['hospital_admin', 'super_admin', 'receptionist', 'pharmacist'].contains(role)) {
      return '/unauthorized';
    }
    return null;
  },
  routes: [...],
)
```

Within `/admin`, screen-level widgets additionally check finer-grained permissions (e.g. only `pharmacist`/`hospital_admin` see the "Adjust Stock" button) — same permission matrix as the backend, mirrored client-side for UX only (never trusted as the actual authorization boundary — that's enforced server-side per `08-volume1-foundation.md`).

---

## 3. State Management Pattern (Riverpod)

- **Auth state:** `authStateProvider` (StreamProvider wrapping `FirebaseAuth.instance.authStateChanges()`), exposes current user + role
- **Per-feature state:** `StateNotifierProvider` per screen/flow (e.g. `appointmentBookingProvider` holds the multi-step booking wizard state: hospital → doctor → date → slot → payment)
- **Server data:** `FutureProvider`/`AsyncNotifierProvider` per resource, backed by the repository layer — screens never call Dio directly
- **Caching:** Hive boxes for offline-readable data (appointments, prescriptions, medicine list) with a `syncStatus` field for offline-first screens; `flutter_secure_storage` reserved for tokens only

---

## 4. Screens That Can Be Built Now (API-independent)

These don't need the backend contract finalized — pure UI/navigation/local-state work:

- Splash, onboarding, login/OTP/register/forgot-password (UI shells; wire to Firebase Auth directly)
- All bottom navigation shells for the 3 apps
- Static layout screens: Profile, Settings, Notifications list (UI only, empty states)
- Design system: buttons, cards, chips, bottom sheets, empty states, loading states

## Screens That Must Wait on Volume 2/3 (API-dependent)

- Any screen with real data lists/forms tied to Firestore field names: doctor search/listing, appointment booking wizard, patient details, EMR/consultation, prescription writer, all of inventory (medicine list/details/add), billing, reports/analytics dashboards

---

## 5. Recommended Build Sequence for the Flutter App

1. Scaffold `core/` (router, theme, network client, DI) + design system widgets — **can start immediately**
2. Build auth flow end-to-end against real Firebase Auth — **can start immediately**
3. Build static/shell screens for all 3 apps with placeholder data — **can start immediately**
4. Once Volume 2 (Firestore schema) lands → define `shared_models/` entities to match exactly
5. Once Volume 3 (API design) lands → wire `data/` repository implementations to real endpoints, replace placeholder data screen by screen

This lets Flutter work start now in parallel with backend schema/API design, without producing throwaway work.
