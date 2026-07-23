# KAYA — Saúde digital, triagem e teleconsulta

Plataforma full-stack KAYA: website/PWA em React, API FastAPI e uma app Expo para iOS e Android.

O plano consolidado de produto, negócio, operação e lançamento está em [`PRODUCT_AND_LAUNCH_PLAN.md`](PRODUCT_AND_LAUNCH_PLAN.md).

## Architecture

```
├── backend/                        # FastAPI REST API
│   ├── app/
│   │   ├── main.py                 # Application factory, router registration
│   │   ├── config.py               # Pydantic Settings (env-based)
│   │   ├── database.py             # SQLAlchemy engine, session, Base
│   │   ├── models.py               # Core models (User, Account, etc.)
│   │   ├── health_models.py        # Health domain models
│   │   ├── health_schemas.py       # Health Pydantic schemas
│   │   ├── rbac.py                 # RBAC + consent enforcement
│   │   ├── services/
│   │   │   ├── triage_engine.py    # Rule-based triage engine (15 questions)
│   │   │   ├── health_storage.py   # DO Spaces / local file storage
│   │   │   └── pdf_generator.py    # Prescription & referral PDFs
│   │   └── routers/                # 9 health routers + auth + admin
│   ├── alembic/                    # Database migrations
│   ├── tests/                      # pytest integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── api.ts                  # Axios + JWT interceptor
│   │   ├── AuthContext.tsx          # Auth state management
│   │   ├── ProtectedRoute.tsx      # Route guard + sidebar layout
│   │   ├── components/Sidebar.tsx   # Role-based navigation
│   │   └── pages/                  # 10 pages (login, triage, consults, etc.)
│   ├── vite.config.ts              # Dev proxy to backend :8000
│   └── package.json
├── docker-compose.yml              # PostgreSQL + Redis + backend
└── README.md
│       ├── consultations.py     # Booking, queue, accept, complete (SOAP)
│       ├── prescriptions.py     # Prescriptions, referrals, file downloads
│       ├── corporate.py         # Corporate accounts & employee enrollment
│       ├── health_billing.py    # Payment checkout & invoices
│       ├── compliance.py        # Consent management (GDPR-style)
│       └── health_dashboard.py  # KPIs & admin dashboard
├── alembic/                     # Database migrations
├── tests/
│   ├── conftest.py              # Pytest fixtures (TestClient, temp SQLite)
│   └── test_health.py           # Integration + unit tests
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Quick Start (Local Dev)

```bash
# ── Backend ──
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env → set SECRET_KEY (generate: python -c "import secrets; print(secrets.token_hex(32))")
alembic upgrade head
uvicorn app.main:create_application --factory --reload --port 8000

# ── Frontend (new terminal) ──
cd frontend
npm install
npm run dev          # → http://localhost:5173 (proxies API to :8000)
```

- **Swagger UI**: http://localhost:8000/docs
- **Frontend**: http://localhost:5173

## Quick Start (Docker)

```bash
cp backend/.env.example .env
# Edit .env with production values
docker compose up --build -d

# Run migrations inside the container
docker compose exec backend alembic upgrade head
```

## MVP Flow (End-to-End)

### 1. Register & Login
```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "paciente@example.com", "password": "Senha@1234"}'

# Login → get access_token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "paciente@example.com", "password": "Senha@1234"}'
```

### 2. Create Patient Profile
```bash
curl -X POST http://localhost:8000/api/v1/patients/profile \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"date_of_birth": "1990-05-20", "gender": "male", "blood_type": "A+"}'
```

### 3. Accept Required Consents
```bash
for consent in privacy_policy telemedicine_consent terms_of_service; do
  curl -X POST http://localhost:8000/api/v1/compliance/consent \
    -H "Authorization: Bearer <TOKEN>" \
    -H "Content-Type: application/json" \
    -d "{\"consent_type\": \"$consent\"}"
done
```

### 4. Run Triage
```bash
# Start triage session
curl -X POST http://localhost:8000/api/v1/triage/start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"chief_complaint": "Dor de cabeça intensa"}'
# → Returns session_id + questions

# Submit answers
curl -X POST http://localhost:8000/api/v1/triage/<SESSION_ID>/answers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"answers": {"chest_pain": "no", "fever": "yes", "pain_level": "6"}}'

# Complete triage → get risk level + recommendation
curl -X POST http://localhost:8000/api/v1/triage/<SESSION_ID>/complete \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Book Consultation
```bash
curl -X POST http://localhost:8000/api/v1/consultations/book \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"specialty": "clinica_geral", "triage_session_id": "<SESSION_ID>"}'
```

### 6. Doctor Accepts & Completes
```bash
# Doctor views queue
curl http://localhost:8000/api/v1/doctor/queue \
  -H "Authorization: Bearer <DOCTOR_TOKEN>"

# Doctor accepts consultation
curl -X POST http://localhost:8000/api/v1/doctor/queue/<CONSULT_ID>/accept \
  -H "Authorization: Bearer <DOCTOR_TOKEN>"

# Doctor completes with SOAP notes
curl -X POST http://localhost:8000/api/v1/consultations/<CONSULT_ID>/complete \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "subjective": "Paciente refere cefaleia há 3 dias.",
    "objective": "PA 120/80, sem sinais focais.",
    "assessment": "Cefaleia tensional.",
    "plan": "Paracetamol 1g 8/8h, reavaliação em 7 dias.",
    "outcome": "resolved"
  }'
```

## Triage Engine

The rule-based triage engine evaluates 15 questions:

| Risk Level | Score   | Action       | Description                |
|------------|---------|--------------|----------------------------|
| **URGENT** | ≥40     | ER_NOW       | Red flags → emergency      |
| **HIGH**   | 30-39   | DOCTOR_NOW   | Needs immediate consult    |
| **MEDIUM** | 20-29   | DOCTOR_24H   | Schedule within 24h        |
| **LOW**    | <20     | SELF_CARE    | Self-care with guidance    |

**Red flags** (auto-URGENT): chest pain, breathing difficulty, fainting, stroke signs, severe bleeding, mental health crisis.

## RBAC Roles

| Role              | Access                                          |
|-------------------|--------------------------------------------------|
| `patient`         | Own profile, triage, consultations, prescriptions|
| `doctor`          | Queue, consultations, prescribe, referrals       |
| `corporate_admin` | Company account, employee enrollment, KPIs       |
| `admin`           | Doctor verification, dashboard, all data         |
| `support`         | Dashboard, audit logs                            |

## Running Tests

```bash
cd backend
pytest tests/ -v

# With coverage
pytest tests/ --cov=app --cov-report=term-missing
```

## API Endpoints

| Method | Path                                        | Auth     | Description                    |
|--------|---------------------------------------------|----------|--------------------------------|
| POST   | `/auth/register`                            | —        | Register (email/password)      |
| POST   | `/auth/login`                               | —        | Login → JWT                    |
| POST   | `/api/v1/patients/profile`                  | Patient  | Create patient profile         |
| GET    | `/api/v1/patients/me`                       | Patient  | Get own profile                |
| PATCH  | `/api/v1/patients/me`                       | Patient  | Update profile                 |
| POST   | `/api/v1/triage/start`                      | Patient  | Start triage session           |
| POST   | `/api/v1/triage/{id}/answers`               | Patient  | Submit triage answers          |
| POST   | `/api/v1/triage/{id}/complete`              | Patient  | Complete & get result          |
| GET    | `/api/v1/triage/history`                    | Patient  | Triage history                 |
| POST   | `/api/v1/compliance/consent`                | Patient  | Accept consent                 |
| GET    | `/api/v1/compliance/consents`               | Patient  | List consents                  |
| POST   | `/api/v1/consultations/book`                | Patient* | Book consultation              |
| GET    | `/api/v1/consultations/me`                  | Patient  | My consultations               |
| PATCH  | `/api/v1/consultations/{id}`                | Patient  | Cancel consultation            |
| GET    | `/api/v1/doctors/`                          | Public   | List verified doctors          |
| POST   | `/api/v1/doctors/profile`                   | Doctor   | Create doctor profile          |
| GET    | `/api/v1/doctor/queue`                      | Doctor†  | View consultation queue        |
| POST   | `/api/v1/doctor/queue/{id}/accept`          | Doctor†  | Accept consultation            |
| POST   | `/api/v1/consultations/{id}/complete`       | Doctor†  | Complete with SOAP notes       |
| POST   | `/api/v1/consultations/{id}/prescription`   | Doctor†  | Create prescription + PDF      |
| POST   | `/api/v1/consultations/{id}/referral`       | Doctor†  | Create referral + PDF          |
| GET    | `/api/v1/files/{id}`                        | Owner    | Signed file download URL       |
| GET    | `/api/v1/doctors/pending`                   | Admin    | List pending doctors           |
| POST   | `/api/v1/doctors/{id}/verify`               | Admin    | Approve/reject doctor          |
| GET    | `/api/v1/dashboard/health`                  | Admin    | Health KPIs                    |
| GET    | `/api/v1/dashboard/admin`                   | Admin    | Admin dashboard stats          |
| POST   | `/api/v1/corporate/accounts`                | Admin    | Create corporate account       |
| POST   | `/api/v1/corporate/enroll`                  | Corp     | Enroll employee                |
| GET    | `/api/v1/corporate/kpis`                    | Corp     | Corporate KPIs                 |
| POST   | `/api/v1/billing/consultation/checkout`     | Patient  | Pay for consultation           |
| GET    | `/api/v1/billing/me/invoices`               | Patient  | Payment history                |

*Requires all consents · †Requires verified doctor

## Frontend Pages

| Route | Role | Description |
|---|---|---|
| `/login` | Public | Email/password login |
| `/register` | Public | Create account |
| `/patient/profile` | Patient | Create/view patient profile |
| `/triage` | Patient | 3-step triage wizard (complaint → questions → result) |
| `/consultations` | Patient | Book, list, cancel consultations |
| `/consents` | Patient | Accept required consents (3 types) |
| `/doctor/profile` | Doctor | Register/view doctor profile |
| `/doctor/queue` | Doctor | Accept consultations, write SOAP notes |
| `/admin/dashboard` | Admin | KPI cards (patients, doctors, revenue) |
| `/admin/doctors` | Admin | Approve/reject pending doctors |

**Stack**: React 19 · Vite 7 · TypeScript · Tailwind CSS 4 · React Router 6 · Axios · Lucide Icons

## Deployment (DigitalOcean)

1. Create a **Managed PostgreSQL** database
2. Create a **Spaces** bucket for file storage
3. Deploy via **App Platform** or **Droplet** with Docker
4. Set environment variables from `.env.example`
5. Run `alembic upgrade head` on first deploy
6. Build frontend: `cd frontend && npm run build` → serve `dist/` via nginx or CDN

## License

Proprietary — All rights reserved.
