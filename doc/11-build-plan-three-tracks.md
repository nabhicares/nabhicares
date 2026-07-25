# Build Plan — Three-Track Task Breakdown

Everything needed to actually start building splits cleanly into **three parallel tracks**. They're not independent — each has explicit sync points where one track blocks another — but structuring it this way lets work start on two of the three right now while the third (the actual blocker) gets finished.

```text
Track A: Backend (Firestore schema + NestJS API)
Track B: Flutter App (mobile client)
Track C: Infrastructure & Quality (Firebase setup, DevOps, testing)
```

---

## Track A — Backend (Database + API)

**Status: the critical path. Everything else waits on this.**

| # | Task | Depends on | Status |
|---|---|---|:---:|
| A1 | Firestore schema — collections, sub-collections, field shapes, denormalization decisions | Vol. 1 (done) | ❌ Not started |
| A2 | Composite index plan (per screen query pattern) | A1 | ❌ Not started |
| A3 | Transaction boundaries — where Firestore `runTransaction` is mandatory (inventory ledger is the critical one) | A1 | ❌ Not started |
| A4 | Full API endpoint spec — all ~150–200 routes, request/response shapes, validation rules, error cases | A1, A2, A3 | ❌ Not started |
| A5 | NestJS DTOs (class-validator schemas) for every endpoint | A4 | ❌ Not started |
| A6 | Repository layer implementation per module (Firestore access) | A1, A5 | ❌ Not started |
| A7 | Service layer business logic per module (booking rules, stock rules, billing rules) | A6 | ❌ Not started |
| A8 | Controller layer wiring (guards, roles, response envelope) | A7, Vol.1 RBAC (done) | ❌ Not started |
| A9 | Inventory module deep spec — medicine lifecycle, batch/expiry logic, purchase/sales/returns state machine | A1 | ⚠️ Outlined only |
| A10 | Hospital ops deep spec — appointment lifecycle, consultation, prescription, billing state machines | A1 | ⚠️ Outlined only |

**Next immediate action on this track:** A1 (Firestore schema) — this is Volume 2 from the master plan and is the single highest-leverage task in the whole project.

---

## Track B — Flutter App (Mobile Client)

**Status: can start now on the API-independent half.**

| # | Task | Depends on | Status |
|---|---|---|:---:|
| B1 | Project scaffold — folder structure, theme, DI, network client | none | ✅ Spec'd (`10-flutter-app-architecture.md`) — needs actual `flutter create` + wiring |
| B2 | go_router setup with role-based redirect | none | ✅ Spec'd — needs implementation |
| B3 | Firebase Auth integration (login/OTP/register/forgot-password screens) | Firebase project exists (Track C) | ❌ Not started |
| B4 | Design system components (buttons, cards, chips, bottom sheets, states) | none | ❌ Not started |
| B5 | Navigation shells for all 3 apps (bottom nav, placeholder screens) | B1, B2 | ❌ Not started |
| B6 | Shared data models (`shared_models/`) matching Firestore doc shapes | **A1** | ❌ Blocked |
| B7 | Repository implementations wired to real API endpoints | **A4** | ❌ Blocked |
| B8 | Real data screens — doctor search, booking wizard, EMR, prescriptions, inventory, billing, reports | **A4**, B6, B7 | ❌ Blocked |
| B9 | Offline caching strategy (Hive) + sync status handling | B7 | ❌ Blocked |
| B10 | Push notification handling (FCM) client-side | Firebase project exists (Track C) | ❌ Not started |

**Next immediate action on this track:** B1–B5 can start today without waiting on Track A. B6 onward is blocked until Track A produces the schema.

---

## Track C — Infrastructure & Quality

**Status: mostly needs to happen outside this chat, on your accounts/machines.**

| # | Task | Depends on | Status |
|---|---|---|:---:|
| C1 | Create Firebase project; enable Firestore, Auth, Storage, FCM | none | ❌ Needs to happen in Firebase Console |
| C2 | Add Android + iOS apps to Firebase project, download config files (`google-services.json`, `GoogleService-Info.plist`) | C1 | ❌ Not started |
| C3 | Set up NestJS project repo, install `firebase-admin`, wire `firebase.config.ts` | C1 | ❌ Not started |
| C4 | Set up Flutter project repo, install Firebase plugins | C2 | ❌ Not started |
| C5 | Firestore & Storage security rules (lock down direct client access — see Vol.1 note) | A1 | ❌ Blocked |
| C6 | Deployment pipeline — Docker + Cloud Run for backend | C3 | ❌ Not started |
| C7 | CI — lint/test on push (both repos) | C3, C4 | ❌ Not started |
| C8 | Error tracking (Sentry) wired into both backend and Flutter | C3, C4 | ❌ Not started |
| C9 | Testing strategy doc (unit/integration/e2e per module) | A1, A4 | ❌ Blocked (Vol. 8) |

**Next immediate action on this track:** C1–C2 — creating the actual Firebase project — can and should happen today, independent of everything else. It's a 10-minute console task and unblocks B3/B10/C4.

---

## How the Three Tracks Align

```text
                    ┌─────────────────────┐
                    │   Track C: C1, C2    │  (Firebase project — do this first, unblocks B3/B10)
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                                              │
┌───────▼────────┐                            ┌────────▼────────┐
│ Track A: A1–A3   │  ◄── critical path ──►    │ Track B: B1–B5   │
│ (Firestore       │      A1 blocks B6+        │ (scaffold, auth, │
│  schema)         │                            │  nav shells)     │
└───────┬────────┘                            └────────┬────────┘
        │                                              │
┌───────▼────────┐                                     │
│ Track A: A4–A10  │  ◄── blocks ──────────────────────┘
│ (API spec,       │      B6, B7, B8, B9
│  DTOs, logic)     │      C5, C9
└─────────────────┘
```

**Sync point 1:** Track C (C1–C2, Firebase project) → unblocks Track B's auth screens (B3) and push notifications (B10). Do this immediately, it costs nothing to start now.

**Sync point 2:** Track A (A1, Firestore schema) → unblocks Track B's real data models (B6) and Track C's security rules (C5).

**Sync point 3:** Track A (A4, API spec) → unblocks Track B's repository wiring (B7) and all real data screens (B8).

So the actual critical path through the whole project is: **A1 → A4 → B7/B8**. Everything else can run in parallel around that spine.

---

## What "Ready to Build" Actually Means Here

Not a single go/no-go — readiness is per-track:

| Track | Ready to start now? |
|---|---|
| A (Backend) | ✅ Ready to start A1 (Firestore schema) — no blockers |
| B (Flutter, API-independent tasks B1–B5) | ✅ Ready to start now |
| B (Flutter, API-dependent tasks B6+) | ❌ Blocked on A1/A4 |
| C (Firebase project setup C1–C2) | ✅ Ready to start now — action item for you, outside this chat |
| C (everything else) | ❌ Blocked on A1/C1 |

## Verified Answer: Are We Ready to Build the Full Application?

**No — not the full application end-to-end.** What we're ready for is a specific, well-defined slice of work starting today: Firestore schema design (A1), Flutter project scaffold + auth + nav shells (B1–B5), and Firebase project creation (C1–C2). The parts that make this a *real, functioning* hospital system — booking, EMR, prescriptions, inventory, billing — are still gated behind the Firestore schema and API spec, which don't exist yet.

**Recommended next step:** Start Track A1 (Firestore schema) now — it's the one task every other blocked task is waiting on. Say "do A1" / "build the Firestore schema" and I'll produce the full Volume 2 spec next.
