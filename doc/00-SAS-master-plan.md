# Software Architecture Specification (SAS) — Master Plan

Full scope estimate for this platform:

- ~150–200 REST API endpoints
- ~60–80 PostgreSQL tables
- 150+ request/response DTOs (Pydantic schemas)
- Complete ER diagrams and relationships
- RBAC permission matrix
- Authentication flows
- Notification event definitions
- API versioning and error contracts
- Inventory transaction model
- Appointment / prescription / billing / doctor-scheduling workflows

This is too large for one document — it's the equivalent of a 250–400 page architecture spec. It will be built **volume by volume**, in dependency order, so each volume is a stable contract the next one can build on.

---

## Volumes

| Vol. | Title | Contents | File |
|---|---|---|---|
| 1 | System Architecture | Overall architecture, module communication, auth, RBAC, folder structure, deployment, event flow | `07-technical-architecture-stack.md` (stack — Node.js/NestJS + Firebase) + `08-volume1-foundation.md` (foundation contracts) |
| 2 | Database Design | Every table: columns, types, constraints, indexes, FKs, relationships, soft-delete strategy, audit fields | *pending* |
| 3 | API Design | Every endpoint: URL, method, auth, request/query/path params, validation, success/error responses, business rules | *pending* |
| 4 | Backend Schemas | Pydantic request/response models, shared DTOs, pagination, filters, error models | *pending* |
| 5 | Flutter Integration | Feature-wise API mapping, screen↔API matrix, offline strategy, caching, state management flow | *pending* |
| 6 | Inventory Module | Medicine lifecycle, stock transaction engine, batch management, expiry logic, purchase/sales/returns, analytics | *pending* |
| 7 | Hospital Operations | Appointment lifecycle, consultation, prescription, billing, reports, notifications | *pending* |
| 8 | Developer Documentation | Coding standards, API naming, error codes, versioning, testing strategy | *pending* |

---

## Build Order

1. **Foundation** — folder structure, authentication, RBAC, common response format, error handling
2. **Database** — complete PostgreSQL schema, ER diagrams, relationships, indexes
3. **API** — every endpoint, request/response schemas, validation rules
4. **Flutter integration** — repository mapping, screen-to-endpoint mapping
5. **Production architecture** — Docker, CI/CD, logging, monitoring, caching, background jobs

## Why volume-by-volume instead of one pass

Compressing this into a single response risks omissions and inconsistencies — and the Flutter frontend will depend directly on these contracts being stable. Building module by module gives:

- Stable API contracts
- Consistent database design
- Easier parallel development (Flutter team vs. backend team)
- Better testing and maintenance
- Room for future scale (multi-hospital, AI features, web admin) without rearchitecting

---

Volume 1 (Foundation) is started in `08-volume1-foundation.md`. Say the word and I'll move on to Volume 2 (full database schema) next — that's the biggest and most load-bearing piece, so it's worth doing carefully rather than rushing.
