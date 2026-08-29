# SIH Project - Initial Setup Guide

## Project Structure

```
SIH-Portal/
├── backend/                  # NestJS API (Core Business Logic)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── citizen/      # Handles intake, offline sync logic
│   │   │   ├── university/   # Handles consortia, NEP tagging, Kanban
│   │   │   ├── industry/     # Handles Smart Escrow, Micro-CSR
│   │   │   ├── government/   # Handles G1-G4 gates, dashboards
│   │   │   └── whatsapp/     # [NEW] WhatsApp Voice-bot webhook handlers
│   │   └── ai-gateway/       # Async client wrappers for AI/ML calls
│   ├── package.json
│   └── nest-cli.json
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
├── mobile/                   # Flutter Mobile App
│   ├── lib/
│   │   ├── screens/
│   │   ├── offline_sync/     # Critical for rural Jharkhand areas
│   │   └── main.dart
│   └── pubspec.yaml
│
├── supabase/                 # PostgreSQL + Auth
│   └���─ migrations/
│
├── shared/                   # [NEW] Shared Types/Interfaces
│   └── types/                # TypeScript interfaces for NestJS + Next.js
│
├── docker-compose.yml
├── .env
└── SETUP-GUIDE.md
```

## Prerequisites (Checklist)
- [x] Node.js 20+ (v24.11.1 installed)
- [x] Python 3.11+ (3.13.7 installed)
- [x] Supabase CLI (2.116.0 installed)
- [x] Docker Desktop (29.7.2 installed)
- [ ] Flutter SDK (needs installation)
- [x] Neo4j Aura (configured - cloud instance)

## Neo4j Aura Configuration
```
NEO4J_URI=neo4j+s://da0651ee.databases.neo4j.io
NEO4J_USERNAME=da0651ee
NEO4J_PASSWORD=6hCm8FJNZJyxywF3ZyakWbaACsQUI9_XbFUNNryJCh4
NEO4J_DATABASE=da0651ee
```

## Quick Start Commands

### 1. Install Flutter
```powershell
cd C:\Users\ARNAV_TFS\OneDrive\Documents\SIH\NEW\project-setup
.\setup-flutter.ps1
```

### 2. Initialize Supabase Project
```bash
supabase init
supabase start
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

### Mobile (Flutter)
```bash
cd mobile
flutter pub get
flutter run
```

### Docker Services
```bash
docker compose up -d
docker compose logs -f
docker compose down
```

## First Sprint: Citizen Intake Module (G1 Gate)
1. Create citizen user schema in Supabase
2. Build intake API endpoints (POST /issues, GET /issues/:id)
3. Add geotagging via Flutter mobile app
4. Implement WhatsApp voice-bot intake flow
5. Build admin review queue (G1 gate)

Run `supabase start` to initialize the database, then let me know when ready to proceed!
