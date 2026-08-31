# JEEVAN: Jharkhand Ecosystem for Experiential Validation Adoption Network

JEEVAN is a state-level portal and mobile application ecosystem designed for Smart India Hackathon. Its goal is to turn citizen issue reports into student-led innovation projects, governed by a four-gate accountability model (G1–G4) in which a project is only a success once a local body has taken formal ownership and continued use is confirmed six months later.

## Status

**Early development.** The backend currently implements citizen issue intake and a G1 review queue. The gate engine, identity/RBAC, AI gateway, escrow, and reporting are planned but not built — see [implementation_plan.md](./implementation_plan.md) for the phase-by-phase roadmap and the current position in it.

Do not read the stack list below as a description of working features.

## Architecture & Tech Stack

- **Backend**: NestJS v10 + TypeORM (PostgreSQL) + class-validator + Swagger Docs. Modules are organised by **domain**, not by user role — see `parameter.md` §1.
- **Mobile Application**: React Native + Expo (Dev Client + EAS Build) + SQLite (offline resilience) + Expo Location (geotagging)
- **ML Services**: Python/FastAPI. Currently returns mock responses by design (`parameter.md` §3); no model is wired up yet.
- **Web Portal**: Next.js 14 *(being replaced)*
- **Database**: PostgreSQL (local via Docker Compose). Managed-hosting and knowledge-graph choices are open decisions — see `docs/adr/`.

## Project Structure

- `/backend` - NestJS API (domain modules: `auth`, `issues`, …)
- `/ml-service` - Python/FastAPI Machine Learning Service
- `/web` - Next.js Web App *(being replaced)*
- `/mobile` - React Native Expo Application
- `/docs/adr` - Architecture decision records

## Getting Started

Refer to [SETUP-GUIDE.md](./SETUP-GUIDE.md) for prerequisites and setup, then [implementation_plan.md](./implementation_plan.md) for what to build next.