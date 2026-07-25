# Volume 1 — Foundation

Covers: folder structure, authentication flow, RBAC model, common response envelope, and error handling contract. Everything downstream (database, API, Flutter integration) builds on these conventions.

**Updated for Node.js (NestJS) + Firebase** — replaces the earlier FastAPI/custom-JWT version.

---

## 1. Backend Folder Structure (NestJS, expanded)

```text
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts     # maps errors to standard envelope
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts      # wraps success responses in envelope
│   │   │   └── logging.interceptor.ts
│   │   ├── guards/
│   │   │   ├── firebase-auth.guard.ts        # verifies Firebase ID token
│   │   │   └── roles.guard.ts                # checks custom-claim role/permission
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts            # @Roles('doctor', 'hospital_admin')
│   │   │   └── current-user.decorator.ts     # @CurrentUser() -> decoded token
│   │   └── dto/
│   │       └── pagination.dto.ts
│   ├── config/
│   │   └── firebase.config.ts                # initializes firebase-admin app
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts                # role claim assignment, session bookkeeping
│   │   │   └── dto/
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
│   │       # each module follows: *.controller.ts, *.service.ts,
│   │       # *.repository.ts, dto/, entities/ (Firestore doc interfaces)
│   └── database/
│       └── firestore.service.ts               # thin wrapper around firebase-admin Firestore
└── test/
    ├── unit/
    └── e2e/
```

**Layering rule (unchanged principle):**
`controller` (presentation) → `service` (domain/business logic) → `repository` (Firestore access) → Firestore document interfaces. Controllers never call Firestore directly; they call a service, which calls a repository.

---

## 2. Authentication Flow — Firebase Auth

No custom JWT issuing/refresh logic is needed — Firebase Auth owns the token lifecycle. The backend's job is to **verify** tokens and manage **role assignment**, not mint or rotate tokens itself.

### Client-side (Flutter, via `firebase_auth`)
- Email/password sign-in, or phone sign-in (Firebase Auth's native OTP flow — no custom SMS/OTP endpoints required for auth itself)
- Firebase SDK automatically handles ID token refresh in the background
- Client attaches the current ID token to every API call: `Authorization: Bearer <idToken>`

### Backend-side (NestJS, via `firebase-admin`)
```text
Request → FirebaseAuthGuard
        → admin.auth().verifyIdToken(idToken)
        → attaches decoded token (uid, role claim, etc.) to request
        → RolesGuard checks required @Roles()/@Permission() against the claim
        → controller handler runs
```

### Endpoints that remain (thin wrappers, not full auth systems)
```text
POST /api/v1/auth/register-profile   # create Firestore `users` doc after Firebase Auth signup
POST /api/v1/auth/assign-role        # admin-only: sets custom claim (role) on a Firebase Auth user
GET  /api/v1/auth/me                 # returns current user's profile + role
POST /api/v1/auth/logout             # optional: revoke refresh tokens via admin.auth().revokeRefreshTokens(uid)
```

### Staff account creation flow (doctor/receptionist/pharmacist/admin)
```text
Hospital Admin (in-app) → POST /users {email, role, ...}
Backend → admin.auth().createUser(...)
        → admin.auth().setCustomUserClaims(uid, { role })
        → create matching Firestore `users/{uid}` profile doc
        → (optional) send invite email via SendGrid/Resend
```
Patients self-register via the normal Firebase Auth sign-up flow in the app; a `users/{uid}` doc with `role: 'patient'` is created on first login via `register-profile`.

---

## 3. RBAC Model — Firebase Custom Claims

### Roles
`super_admin | hospital_admin | doctor | receptionist | pharmacist | patient`

### Design
- Role lives as a **custom claim** on the Firebase Auth user (`{ role: 'doctor', hospitalId: '...' }`), set server-side only via `firebase-admin` — never settable by the client.
- `users/{uid}` Firestore doc mirrors the same role for querying/display convenience (e.g. "list all doctors"), but the **claim is the source of truth for authorization**, since it's what's embedded in the verified ID token on every request.
- Fine-grained `permissions` (e.g. `inventory.write`, `billing.refund`) can either be:
  - **Derived in code** from role (simplest — a lookup table in the NestJS `RolesGuard`), or
  - **Stored in Firestore** (`rolePermissions` collection) and checked against, if you want permissions editable without a deploy.
  Recommendation: start with the code-derived lookup table (simpler, faster, fewer Firestore reads per request); move to a Firestore-backed matrix only if you need runtime-configurable permissions later.

### Enforcement (illustrative NestJS)
```typescript
// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('roles', context.getHandler());
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest(); // set by FirebaseAuthGuard
    return required.includes(user.role);
  }
}

// usage in a controller
@Roles('super_admin', 'hospital_admin', 'pharmacist')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Post('inventory/adjust')
adjustStock(@Body() dto: StockAdjustDto, @CurrentUser() user: DecodedUser) { ... }
```

### Sample permission matrix (excerpt — full matrix belongs in Volume 3)

| Permission | Super Admin | Hospital Admin | Doctor | Receptionist | Pharmacist | Patient |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| patients.read | ✓ | ✓ | ✓ (own patients) | ✓ | ✓ | ✓ (self only) |
| patients.write | ✓ | ✓ | – | ✓ | – | ✓ (self only) |
| appointments.write | ✓ | ✓ | ✓ (own schedule) | ✓ | – | ✓ (self, book only) |
| prescriptions.write | ✓ | – | ✓ | – | – | – |
| inventory.write | ✓ | ✓ | – | – | ✓ | – |
| billing.refund | ✓ | ✓ | – | – | – | – |
| reports.view.financial | ✓ | ✓ | – | – | – | – |
| settings.write | ✓ | ✓ | – | – | – | – |

### Firebase Storage & Firestore security rules
Since Flutter *could* talk to Firestore/Storage directly (not just through the NestJS API), decide explicitly: **all reads/writes go through the NestJS API**, and Firestore/Storage security rules are locked down to deny direct client access (`allow read, write: if false;`), except for narrow cases you intentionally allow (e.g. FCM token registration). This keeps RBAC and business rules (like stock transaction integrity) enforced in one place — the backend — rather than duplicated in security rules.

---

## 4. Common Response Envelope

Unchanged shape — still applies with NestJS via a global `ResponseInterceptor`.

### Success
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 134
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "quantity must be greater than 0",
    "field": "quantity",
    "request_id": "a1b2c3d4"
  }
}
```

---

## 5. Error Handling Contract

### Standard error codes

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | class-validator DTO validation failed |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired Firebase ID token |
| 403 | `FORBIDDEN` | Authenticated but role/claim lacks permission |
| 404 | `NOT_FOUND` | Firestore document doesn't exist |
| 409 | `CONFLICT` | e.g. double-booking a slot, duplicate entity |
| 422 | `UNPROCESSABLE` | Semantically invalid (e.g. dispensing more than in stock) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error (logged + Sentry) |

- A global NestJS exception filter (`HttpExceptionFilter`) catches everything thrown from `services/` and maps it to this envelope — controllers never build error JSON by hand.
- Every response includes a `request_id` for correlating client bug reports with server logs.

---

## 6. Next Volumes

- **Volume 2 — Database Design**: full Firestore schema (collections, sub-collections, document field shapes, composite indexes, denormalization decisions, transaction boundaries) — replaces the earlier PostgreSQL-table version.
- **Volume 3 — API Design**: full endpoint-by-endpoint spec for all ~150–200 routes, unchanged in scope, just running on NestJS now.

Let me know if you want Volume 2 (Firestore schema) next — Firestore's design process is different enough from a relational schema (denormalization choices, sub-collections vs. top-level collections, composite index planning) that it's worth doing carefully before the API layer locks in on it.
