# Nabhi Care API (FastAPI + Aiven PostgreSQL)

Scalable HMS backend. Firebase Auth for identity only, Aiven PostgreSQL for business data, Cloudinary for files, FCM for push delivery logs.

## Stack

| Concern | Service |
|--------|---------|
| Identity | Firebase Auth (verify ID token → `auth.users.firebase_uid`) |
| Business DB | Aiven PostgreSQL (domain schemas + RLS) |
| Files | Cloudinary (metadata in `patient.documents`) |
| Push | Firebase FCM (logs in `notification.*`) |

Legacy NestJS + Firestore stays in `../backend` until clients cut over.

## Local setup

```bash
cd backend-fastapi
py -3.12 -m venv .venv
.\.venv\Scripts\activate          # Windows
pip install -e ".[dev]"
cp .env.example .env              # fill real values (see below)
```

### `.env` values

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | **Runtime** role URL (`nabhi_app`), not `avnadmin` — RLS only works without BYPASSRLS |
| `DATABASE_MIGRATION_URL` | Aiven `avnadmin` URI (Alembic only) |
| `FIREBASE_PROJECT_ID` | Service account JSON `project_id` |
| `FIREBASE_CLIENT_EMAIL` | Service account JSON `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service account JSON `private_key` (keep `\n` escapes) |
| `CLOUDINARY_URL` | Cloudinary dashboard → Product Environment Credentials |
| `BOOTSTRAP_SECRET` | ≥32 random chars |
| `CORS_ORIGINS` | Comma-separated web origins |
| `ALLOW_MOCK_AUTH` | `true` only for local demo tokens (`Bearer mock-pharmacist`) |

Provision the least-privileged DB role once (admin URL):

```bash
$env:ADMIN_DATABASE_URL="postgres://avnadmin:...@.../defaultdb?sslmode=require"
.\.venv\Scripts\python scripts\provision_runtime_role.py
# writes .env.database — copy DATABASE_URL into .env
```

### Migrate

```bash
alembic upgrade head
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# Health: http://localhost:8000/health/ready
```

First super-admin:

```http
POST /api/v1/bootstrap
X-Bootstrap-Secret: <BOOTSTRAP_SECRET>
{ "hospital_name": "...", "hospital_code": "H1", "firebase_uid": "<uid>", "email": "..." }
```

Hospital-scoped requests need `Authorization: Bearer <Firebase ID token>` and usually `X-Hospital-ID: <uuid>` (mock mode).

## Vercel (optional serverless)

Import repo → Root Directory = `backend-fastapi`. Set the same env vars as `.env` (use runtime `DATABASE_URL`, not admin). Add `requirements.txt` install via `pip install .`. Prefer a long-running host (Railway/Render/Fly) for Postgres pool health; Vercel is fine for light traffic.

## Tests

```bash
$env:TEST_DATABASE_URL="<runtime DATABASE_URL>"
pytest -q
```

Covers concurrent stock oversell prevention and PostgreSQL RLS tenant isolation.

## Schemas

`auth` · `hospital` · `patient` · `doctor` · `appointment` · `consultation` · `prescription` · `pharmacy` · `inventory` · `supplier` · `billing` · `payment` · `notification` · `audit` · `analytics`
