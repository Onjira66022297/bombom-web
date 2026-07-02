# BOMBOM — Presales Support System

Full-stack foundation: real backend (Node/Express + PostgreSQL + JWT auth) wired
to a real frontend (React + Vite + Tailwind), following the approved green
design system (`#3a8a3a` / `#e8f5e9` / `#2e7d32`).

This is **not a mockup** — registering, the pending-approval gate, login, and
the dashboard all hit a live database through the API.

## What's included

- **Auth**: register → pending → admin approve/reject → login (JWT, bcrypt, rate-limited)
- **Roles**: admin, presales, technical_consultant, manager
- **Admin user management**: full UI at `/admin/users` (approve/reject queue + directory) on top of the list/approve/reject/change-role API, audit log
- **Product catalog API**: create as draft → pending_review → publish (human approval gate before entering the live catalog), with compatibility rules table for the CPU×RAM / display×power matrices
- **4-step presales pipeline** (`/cases/new`, real UI + real API):
  1. Start case (Outlook search endpoint is stubbed — returns 501 with clear next steps until Azure AD/Graph credentials are configured; see `backend/src/routes/emails.js`)
  2. Analyze — store extracted requirements (AI extraction to be plugged in later; field shape is ready)
  3. Select Specs — validates the entered E-Code exists in the *published* catalog
  4. Check BOM — upload a real `.xlsx`/`.xls`/`.csv`, parsed with SheetJS and validated row-by-row against the product's CPU/RAM/storage/display/warranty options, plus flagged-incompatible-pair detection via `compatibility_rules`
- **Database schema**: users, audit_log, products, compatibility_rules, cases, bom_checks
- **Frontend**: Login, Registration (password strength meter, pending-approval messaging), Dashboard, Admin Users, Case Workflow — all calling the real API, no mock data
- **Docker Compose** for one-command local Postgres + API

## What's stubbed / next to build

- **Outlook search**: endpoint shape is real (`GET /api/emails/search`), but returns 501 until an Azure AD app registration + Microsoft Graph credentials are added — this is a per-deployment config step, not something to fake with mock data.
- **AI email extraction**: the `analyze` step currently takes freeform text into the same field structure the AI would populate — swap in a real extraction call when ready.
- **AI-powered datasheet ingestion** (PDF/XLSX/DOCX/CSV → product catalog with confidence scores) — the `products` table already has `confidence_score` and `source_document` columns for this; only the ingestion pipeline itself needs building.
- **History and Analytics** screens — `cases` and `audit_log` tables already capture what these views need to query.
- **PDF BOM uploads** — the checker currently supports `.xlsx/.xls/.csv`; PDF parsing needs a dedicated extraction step.

Given how much surface area is left, this is a good point to move into **Claude Code** — it's built for extending a multi-file codebase like this over many sessions, rather than a single chat response.

## Running it locally

### 1. Backend + database (Docker)

```bash
cd backend
cp .env.example .env
# edit .env and set a real JWT_SECRET:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d
```

This starts Postgres (schema auto-loaded from `src/db/schema.sql`) and the API on `http://localhost:4000`.

### 2. Create the first admin account

Registration always starts as `pending` — you need one admin to approve everyone else. Bootstrap it directly:

```bash
docker compose exec api node src/db/seedAdmin.js admin@yourcompany.com "StrongPassword123" "Your Name"
```

(Or run it locally with `npm run seed:admin -- admin@yourcompany.com "StrongPassword123" "Your Name"` if you're running the API outside Docker.)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. Log in with the admin account you seeded, or register a new account (it'll sit in `pending` until an admin approves it via the API — an admin UI for that queue is one of the next screens to build).

### Running backend without Docker

```bash
cd backend
npm install
# requires a local/remote Postgres — set DATABASE_URL in .env accordingly
psql "$DATABASE_URL" -f src/db/schema.sql
npm run dev
```

## Project structure

```
backend/
  src/
    app.js            Express app, middleware, route mounting
    server.js          Entry point
    db/
      schema.sql        Full Postgres schema
      seedAdmin.js       Bootstrap first admin
      index.js           pg connection pool
    routes/            auth.js, users.js, products.js
    middleware/        JWT auth + role guard
    utils/             auth helpers, audit logging
  docker-compose.yml
  Dockerfile

frontend/
  src/
    pages/             Login.jsx, Register.jsx, Dashboard.jsx
    context/           AuthContext.jsx
    api/                client.js (axios, auto-attaches JWT)
    components/         ProtectedRoute.jsx
```

## Security notes for production

- `JWT_SECRET` must be a long random value, unique per environment — never commit it.
- The `.env` file is git-ignored; use your platform's secret manager in production (not plain env files).
- Rate limiting is applied to `/api/auth/*`; consider adding it more broadly behind a reverse proxy (nginx/Cloudflare) for production traffic.
- CORS is restricted to `CORS_ORIGIN` — set this to your real frontend domain in production.
- Passwords are hashed with bcrypt (cost factor 12); never logged or returned in API responses.
