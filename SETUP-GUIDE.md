# SIH Project - Initial Setup Guide

## Project Structure

```
SIH-Portal/
├── backend/                  # NestJS API (Core Business Logic)
│   ├── src/
│   │   ├── modules/          # DOMAIN modules — one per business concept, never per role
│   │   │   ├── auth/         # OTP, sessions, JWT issuance, guards
│   │   │   ├── users/        # users, org units, HEI domain allowlist
│   │   │   ├── issues/       # citizen intake, evidence, corroboration, status
│   │   │   ├── projects/     # demand profile -> project lifecycle, consortium
│   │   │   ├── gates/        # generic G1-G4 gate engine + transition audit
│   │   │   ├── funding/      # escrow ledger, tranche release, payment gateway iface
│   │   │   ├── hei/          # institutions, faculty, teams, calendars, readiness
│   │   │   ├── competencies/ # competency taxonomy + demand/supply matching
│   │   │   ├── notifications/# channel-agnostic outbound messaging
│   │   │   ├── reporting/    # dashboards, leaderboard, impact points
│   │   │   └── intake-channels/ # WhatsApp / voice webhook adapters
│   │   ├── shared/           # RBAC, audit log, filters, interceptors, config
│   │   ├── ai-gateway/       # Async client wrappers for AI/ML calls
│   │   └── db/               # data source, migrations, seeds
│   ├── package.json
│   ├── tsconfig.json         # typecheck + tests
│   └── tsconfig.build.json   # build only — excludes *.spec.ts from dist/
│
├── ml-service/               # Python/FastAPI (The AI Nervous System)
│   ├── app/
│   │   ├── main.py
│   │   ├── triage/           # Spam filter, Emergency bypass logic
│   │   ├── extraction/       # Knowledge graph competency extraction
│   │   ├── prediction/       # Root-cause analysis & forecasting
│   │   ├── gen_ai/           # [NEW] Gen-AI Starter Kit generator (Mock APIs)
│   │   └── models/
│   │       └── neo4j_driver.py
│   └── requirements.txt
│
├── web/                      # Next.js Web Portal
│   ├── src/
│   │   ├── app/
│   │   │   ├── (citizen)/    # Citizen submission tracking
│   │   │   ├── (student)/    # HEI Project Workspace & Co-pilot
│   │   │   ├── (admin)/      # Govt Validation (G1-G4) Dashboards
│   │   │   └── (industry)/   # Matchmaking & Funding Portal
│   │   └── components/
│   ├── package.json
│   └── next.config.js
│
├── mobile/                   # React Native (Expo + Dev Client)
│   ├── app/                  # Expo Router file-based routing
│   │   ├── (tabs)/           # Bottom tab navigation
│   │   └── _layout.tsx       # Root layout
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   ├── services/         # API client, offline sync
│   │   └── hooks/            # Custom React hooks
│   ├── app.config.ts         # Expo config with EAS Build + config plugins
│   ├── eas.json              # EAS Build profiles (dev/preview/production)
│   └── package.json
│
├── docs/adr/                 # Architecture decision records
│
├── docker-compose.yml
├── .env                      # local only — gitignored, never committed
├── .env.example              # placeholders only
├── implementation_plan.md    # phased roadmap — start here
└── SETUP-GUIDE.md
```

> `supabase/` and `shared/` were removed in Phase 0. Both were empty: nothing used Supabase
> (see `docs/adr/0001-supabase-vs-self-hosted-postgres.md`), and shared types will be generated
> from the OpenAPI document rather than hand-maintained (`docs/adr/0013-...`).

## Prerequisites (Checklist)
- [x] Node.js 20+ (v24.11.1 installed)
- [x] Python 3.11+ (3.13.7 installed)
- [x] Docker Desktop (29.7.2 installed)
- [ ] EAS CLI (`npm install -g eas-cli`)
- [ ] Android Studio (for Android emulator + SDK)

Supabase CLI and Neo4j Aura are only needed if ADR-0001 / ADR-0002 are decided in their favour.
Neither is currently used by any code.

## Environment Configuration

Copy `.env.example` to `.env` and fill in real values locally. **Never commit a filled-in `.env`** — `.gitignore` excludes it.

```bash
cp .env.example .env
```

Credentials are distributed out of band, not through this repository. Whether Neo4j is retained at all is an open architectural decision — see `docs/adr/0002-neo4j-vs-pgvector.md`.

## Quick Start Commands

### 1. Set Up Mobile App (React Native / Expo)
```powershell
# Install EAS CLI globally
npm install -g eas-cli

# Install mobile dependencies
cd mobile
npm install

# Configure EAS (first time only — links to Expo account)
eas login
eas build:configure

# Create a dev build for Android
eas build --profile development --platform android

# Start the dev server (connect to dev client, NOT Expo Go)
npx expo start --dev-client
```

### 2. Start PostgreSQL
```bash
docker compose up -d
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install
```

### 4. Install ML Service Dependencies
```bash
cd ml-service
pip install -r requirements.txt
```

### 5. Install Web Dependencies
```bash
cd web
pnpm install
```

## Development Commands

### Backend (NestJS)
```bash
cd backend
npm run start:dev
```

### ML Service (FastAPI)
```bash
cd ml-service
uvicorn app.main:app --reload
```

### Web (Next.js)
```bash
cd web
pnpm dev
```

### Mobile (React Native / Expo Dev Client)
```bash
cd mobile
npx expo start --dev-client
```

### Docker Services
```bash
docker compose up -d
docker compose logs -f
docker compose down
```

## Where to start

The build order is defined in **[`implementation_plan.md`](./implementation_plan.md)**, not here. Start at Phase 0 and do not skip ahead — Phases 0–2 are cross-cutting foundation (decisions, config/migrations/logging, identity + RBAC) that every later domain module depends on.

Run `docker compose up -d` to start PostgreSQL, then `cd backend && npm run start:dev`.
