# JEEVAN Backend — Implementation Plan

**Scope:** backend only (NestJS API, FastAPI ML service, databases, integrations, configuration). The frontend is being replaced separately and is out of scope for this plan.

**Architecture:** domain-driven module axis, defined authoritatively in [`parameter.md`](./parameter.md) §1. Backend modules map to business concepts (`issues`, `projects`, `gates`, `funding`, …), never to user roles. Roles are expressed in the RBAC layer and in thin role-scoped controllers.

**How to use this document:** phases are sequential and each must be verifiable before the next begins. Do not start a phase until its listed decisions are closed.

---

## Status

| | |
|---|---|
| **Completed** | Architecture restructure — role-axis → domain-axis (see below) |
| **Completed** | **Phase 0 — Hygiene.** `.gitignore`, credentials sanitised, dead scaffolding removed, 16 ADRs drafted, README corrected, test + lint baseline established. Compromised Neo4j Aura instance deleted and replaced by the owner; Phase 0 changes committed by the owner. |
| **Decided** | ADR-0001 (self-hosted PostgreSQL), ADR-0014 (Docker Compose on AWS EC2 `ap-south-1`), ADR-0016 (URI path versioning) — Phase 1 unblocked. |
| **Completed** | **Phase 1 — Foundation.** Validated env config, TypeORM migrations (`synchronize` off), structured logging with request IDs, global exception filter + domain error taxonomy, helmet/CORS/throttling, `/api/v1` URI versioning, `/health`, JWT scaffolding, CI. **One item unverified:** `migration:run` against a live database — Docker was unavailable at the time of writing. |
| **Decided** | ADR-0002 (Neo4j dropped, PostgreSQL + pgvector), ADR-0004 (access + rotating refresh tokens in Redis), ADR-0007 (tiered `org_units`, G1 owner via config), ADR-0010 (districts + blocks seeded, HEI seed + admin CRUD), ADR-0015 (scoped by `org_unit_id`) — Phase 2 unblocked. |
| **Completed** | **Phase 2 — Identity, authentication, RBAC.** `users`/`org_units`/`hei_domains`/`audit_log` schema, signed JWTs with rotating refresh tokens in Redis, Redis-backed OTP behind a swappable provider, TOTP for government roles, global auth + `RolesGuard`/`OrgScopeGuard`, audit trail, and Jharkhand master-data seeds. Verified end-to-end against live PostgreSQL + Redis. |
| **Completed** | **Phase 3 complete.** Media evidence via presigned upload to MinIO with per-file geotags, idempotent offline sync (single + batch), geo-radius corroboration, role-aware PII masking, pagination, the Project aggregate and the append-only gate trail. |
| **Next** | Phase 4 — `ai-gateway` and async triage. **Blocked on** ADR-0009. |

### Restructure already applied

The backend module tree was migrated off the role axis:

| Before | After |
|---|---|
| `modules/citizen/citizen.service.ts` (OTP + issue CRUD in one service) | `modules/auth/auth.service.ts` + `modules/issues/issues.service.ts` |
| `CitizenAuthGuard` declared inside `citizen.controller.ts` | `modules/auth/guards/citizen-auth.guard.ts` |
| `citizen.dto.ts` (OTP DTOs + issue DTOs) | `modules/auth/auth.dto.ts` + `modules/issues/issues.dto.ts` |
| `CitizenIssue` entity, table `citizen_issues` | `Issue` entity, table `issues` |
| `src/modules/citizen/citizen-auth.check.ts` (compiled into `dist/`) | `backend/scripts/auth-otp.check.ts` (excluded from `dist/`) |
| Routes `api/citizens/*` **and** `citizen/issues/*` (dual prefix) | `api/auth/*` and `api/issues/*` |

Behaviour was deliberately left unchanged — the mock OTP, the unsigned token, and the unguarded review endpoints all still exist and are fixed in Phases 1–5. This was a structural move only.

**Dependency direction is now acyclic:** `issues → auth`. Nothing imports upward.

---

## Module ownership map

Which domain module owns which documented requirement. Modules not yet created are marked *(planned)*.

| Module | Owns | Phase |
|---|---|---|
| `shared` *(planned)* | RBAC, audit log, exception filters, interceptors, config | 1–2 |
| `auth` | OTP, sessions, JWT issuance, guards | 2 |
| `users` *(planned)* | users, org units, HEI domain allowlist, verification state | 2 |
| `issues` | citizen intake, evidence/media, corroboration, status | 3 |
| `ai-gateway` *(planned)* | async wrappers for all ML/LLM calls, PII stripping | 4 |
| `projects` *(planned)* | demand profile → project lifecycle, consortium assignment | 5 |
| `gates` *(planned)* | generic G1–G4 engine, transitions, evidence rules, audit | 5 |
| `hei` *(planned)* | institutions, faculty, teams, calendars, readiness score | 6 |
| `competencies` *(planned)* | competency taxonomy, demand/supply matching | 6 |
| `funding` *(planned)* | escrow ledger, tranche release, `PaymentGatewayClient` | 7 |
| `notifications` *(planned)* | channel-agnostic outbound messaging | 7 |
| `intake-channels` *(planned)* | WhatsApp / voice webhook adapters feeding `issues` | 7 |
| `reporting` *(planned)* | dashboards, leaderboard, impact points, credentials | 8 |

---

## Decision register

These block implementation. Each must be recorded as an ADR under `/docs/adr/` in Phase 0.

| # | Decision | Blocks | Status / Decision |
|---|---|---|---|
| D1 | Supabase or self-hosted Postgres? | all schema work | **DECIDED** — self-hosted PostgreSQL via Docker Compose; Supabase dropped entirely ([ADR-0001](./docs/adr/0001-supabase-vs-self-hosted-postgres.md)) |
| D2 | Keep Neo4j, or Postgres + `pgvector`? | data model, ML service | **DECIDED** — Neo4j dropped; PostgreSQL + `pgvector` ([ADR-0002](./docs/adr/0002-neo4j-vs-pgvector.md)) |
| D3 | Is `Issue` the same aggregate as `Project`? How does merge work? | **everything** | **DECIDED** — separate aggregates joined by `project_issues` ([ADR-0003](./docs/adr/0003-issue-vs-project-aggregate.md)) |
| D4 | Who issues and verifies tokens? | auth, RBAC, all guards | **DECIDED** — NestJS-issued JWTs; access + rotating refresh tokens in Redis ([ADR-0004](./docs/adr/0004-token-issuer-and-rbac.md)) |
| D5 | Object storage provider and upload flow? | `issues` completion | **DECIDED** — MinIO in Compose (S3-compatible), presigned direct upload ([ADR-0005](./docs/adr/0005-object-storage-and-upload-flow.md)) |
| D6 | How are corroborating reports detected? | G1 enforcement | **DECIDED** — geo-radius 500m + category + 30-day window ([ADR-0006](./docs/adr/0006-corroboration-detection.md)) |
| D7 | Grampanchayat or District Innovation Cell owns G1? | RBAC, org model | **DECIDED** — tiered `org_units`; G1 owner tier from config, default `DISTRICT` ([ADR-0007](./docs/adr/0007-governance-body-for-g1.md)) |
| D8 | Notification channels and provider? | citizen updates, govt alerts | `NotificationProvider` interface + mock |
| D9 | Sync or async AI calls; fallback when ML is down? | `ai-gateway` design | Async via queue, explicit `TRIAGE_PENDING` state |
| D10 | Source for districts/blocks/panchayats/HEI list? | routing, scoping, dashboards | **DECIDED** — seed districts + blocks now, panchayats deferred; HEI seed + admin CRUD ([ADR-0010](./docs/adr/0010-master-data-source.md)) |
| D11 | Money representation; is escrow permanently mocked? | `funding` | Integer paise; permanently mocked, stated in README |
| D12 | Blockchain or signed verifiable credentials? | Phase 8 | Signed VCs with a public verify endpoint |
| D13 | Monorepo tooling and shared-type mechanism? | frontend handoff | pnpm workspaces + generated OpenAPI client |
| D14 | Where does this deploy for the demo? | config, storage, Redis availability | **DECIDED** — Docker Compose on an AWS EC2 VM, `ap-south-1` (Mumbai) ([ADR-0014](./docs/adr/0014-deployment-target.md)) |
| D15 | Is data scoped per district? | every query, guard, index | **DECIDED** — scoped by `org_unit_id` from the JWT; `GOVT_STATE_ADMIN` sees all ([ADR-0015](./docs/adr/0015-district-level-data-scoping.md)) |
| D16 | API versioning and contract style? | all controllers | **DECIDED** — URI path versioning via NestJS native `enableVersioning`, global `api` prefix → `/api/v1/*` ([ADR-0016](./docs/adr/0016-api-versioning-and-contract-style.md)) |

**Documented requirements this plan deliberately deviates from** — each needs explicit sign-off, and if rejected the affected phase changes:

- ~~**D2 (Neo4j).**~~ **Resolved 2026-08-31** — Neo4j dropped in favour of PostgreSQL + `pgvector`; `parameter.md` §1 amended to match.
- **D12 (blockchain credentials).** The solution approach specifies blockchain-verified micro-credentials. This plan recommends signed W3C Verifiable Credentials: same verifiable claim, no chain infrastructure.
- **Predictive engine.** Documented as forecasting against weather/satellite data. A new portal has no history to train on. This plan implements deterministic density/trend aggregation in SQL and keeps the ML version mocked behind the `ai-gateway`.
- **WhatsApp voice-bot.** Requires Meta Business API approval on an external timeline. This plan builds the webhook and provider interface, and demos on a fallback channel.

---

## Phase 0 — Decisions & repo hygiene

**Goal & scope.** Close the decision register, stop the credential leak, and make the repo safe to commit to. No features, no schema.

**Components.**
- Rotate the Neo4j Aura password. It is committed in git history in `.env.example`, `SETUP-GUIDE.md`, and `project-setup/quick-setup.bat` on a pushed repository — deleting the files does not revoke it.
- Add a root `.gitignore` (`.env`, `node_modules/`, `dist/`, `.next/`, `__pycache__/`, `*.tsbuildinfo`). None exists today.
- Commit `backend/src/` — it is currently untracked and exists on one machine only.
- Replace committed secret values with placeholders.
- Delete `/project-setup/*` (Flutter scripts for a React Native project; one leaks the DB password) and the empty `/shared` and `/supabase` directories.
- Record D1–D16 as ADRs under `/docs/adr/`.
- Correct `README.md`'s claims of working G1–G4 gates and Neo4j knowledge-graph ingestion.

**Decisions required first.** D1, D2, D3, D4, D14 at minimum.

**Deliverables.** `.gitignore`; rotated credentials; placeholder-only committed env examples; 16 ADRs; accurate README; fully committed backend.

**Verification.**
- `git status` shows no `node_modules`, `dist`, or `.env`.
- Searching every tracked file at HEAD finds no live secret.
- The old Aura password fails authentication.
- A fresh clone contains all of `backend/src`.

**Risks / assumptions.** Rotation may break a teammate's local setup — coordinate. The leaked password stays in history permanently; rotation is the fix, not history rewriting.

---

## Phase 1 — Backend foundation

**Goal & scope.** Make the app configurable, observable, and schema-versioned before domain code is built on it. Cross-cutting only; no business features.

**Components.**
- `shared/config`: `ConfigModule` with a Zod/Joi env schema. Replace every `process.env.X || default`.
- `db/`: TypeORM `DataSource` file, `synchronize: false` **unconditionally**, working `migration:generate` / `migration:run` (current scripts are broken — no `-d` flag, no datasource file). Initial migration for `issues` plus indexes on `status`, `district`, `isEmergency`, `createdAt`.
- `shared/logging`: `nestjs-pino` + request-ID middleware.
- `shared/filters`: global exception filter and a domain error taxonomy.
- `main.ts`: `helmet`, config-scoped CORS (currently wide open), `@nestjs/throttler`, `enableShutdownHooks()`, Swagger gated to non-production, `/api/v1` global prefix (D16).
- `@nestjs/terminus` health check.
- Jest configured with one passing test — `npm test` cannot currently run (no config, no tests).
- CI running lint + typecheck + test + `migration:run`.

**Decisions required first.** D14, D16, and Phase 0.

**Deliverables.** An app that refuses to boot on bad config, logs structured JSON with correlation IDs, exposes `/health`, and manages schema exclusively through migrations. Green CI.

**Verification.**
- Removing a required env var fails at boot with a named error, not at first query.
- `migration:run` on an empty database produces the full schema.
- One request emits one log line carrying a request ID.
- `/health` reports database status.
- CI passes on a clean clone.

**Risks / assumptions.** The cutover from `synchronize` to migrations needs a local DB reset — cheap now while `issues` is the only table and its data is disposable. Note the table was renamed from `citizen_issues` during the restructure; the old table, if present locally, is orphaned and should be dropped.

---

## Phase 2 — Identity, authentication, RBAC

**Goal & scope.** Replace the mock token scheme with real identity and give every later module a working authorization primitive. The single highest-leverage phase.

**Components.**
- `users` module: `users` table (`id, role, phone, email, org_unit_id, hei_domain, is_verified, totp_secret`) and `org_units` (tier: state / district / block / panchayat / HEI) — this is where D7 is resolved.
- `auth` module: `@nestjs/jwt` + `passport-jwt`. Short-lived access tokens carrying `{sub, role, org_unit}` and **no PII** (`parameter.md` §2), plus refresh tokens. Replaces the unsigned base64 token.
- Redis-backed OTP with TTL and attempt limits, behind an `OtpProvider` interface with a `MockOtpProvider` that logs the code instead of returning it. Removes the `|| '123456'` fallback that currently authenticates any phone with no OTP issued.
- Per-role flows: citizen phone+OTP; student institutional email against the HEI allowlist; industry email+OTP pending manual admin activation; admin email+OTP plus `otplib` TOTP.
- `shared/rbac`: `RolesGuard` + `@Roles()`, and an `OrgScopeGuard` implementing D15.
- `shared/audit`: append-only `audit_log` table + interceptor.
- Throttling on all OTP endpoints.
- Seed Jharkhand org units and the HEI allowlist (D10).

**Decisions required first.** D4, D7, D10, D15, and Phase 1.

**Deliverables.** Four-role authentication, RBAC guards, org scoping, audit logging, seeded master data.

**Verification.**
- A hand-crafted `jeevan-citizen-token-<base64>` is rejected.
- An expired JWT is rejected.
- A citizen token receives 403 on a government route.
- A Ranchi officer cannot read a Dumka record.
- Static `123456` fails when no OTP was issued.
- Admin login without TOTP fails.
- Every privileged action writes an audit row.
- Integration tests via Testcontainers cover each case.

**Risks / assumptions.** Adds Redis as a hard dependency — also needed in Phase 7, so the cost is shared. TOTP enrolment needs a provisioning endpoint; scaffold it now even if its UI comes later.

---

## Phase 3 — `issues` domain: intake, evidence, privacy

**Goal & scope.** Turn the relocated flat table into a correct aggregate with real evidence handling, safe offline intake, and enforced PII rules.

**Components.**
- Resolve D3 in schema: `issues` (raw reports) linked via `issue_links` toward the future demand profile, so the flowchart's G1 *merge* branch is representable. The current single flat table cannot express a merge.
- `media` table (url, type, lat, lng, capturedAt, checksum, issue_id) replacing `imageUrls: text[]`. Required for per-photo geotagging and, later, G3 pilot evidence.
- Object storage per D5: presigned direct upload, MIME and size validation, backend stores metadata only.
- **Idempotent intake:** client-generated `clientId` with a unique constraint, returning the existing record on conflict, plus batch `POST /api/v1/issues/sync`. Without this, offline retry silently duplicates submissions and corrupts the corroboration count G1 depends on.
- Anonymous draft → phone-binding flow (`parameter.md` §2).
- PII masking via `class-transformer` groups: HEI, industry, and public views get district/block only — never phone, email, street address, or exact coordinates (`parameter.md` §8). Today `GET` returns all of it to anonymous callers.
- Pagination on every list endpoint.
- Normalise `district`/`block` to `org_units` foreign keys (currently free-text).
- E.164 phone validation; `language` field (hi/en/sat).
- Remove client-supplied `isEmergency` — it is set by triage in Phase 4.

**Decisions required first.** D3, D5, D10, and Phase 2.

**Deliverables.** A production-shaped intake API: authenticated, idempotent, paginated, PII-masked, with real media handling.

**Verification.**
- Submitting the same `clientId` twice yields exactly one row.
- An HEI-role token fetching an issue receives no phone, email, or street address, and coarsened coordinates.
- Listing 10k seeded issues returns a bounded page.
- A 100 MB file and an `.exe` are both rejected.
- A geotag survives the round trip on each media item.

**Risks / assumptions.** Assumes an S3-compatible store in `docker-compose` (MinIO). Presigned uploads mean the backend never sees file bytes — good for scale, but requires post-upload validation.

---

## Phase 4 — `ai-gateway` and async triage

**Goal & scope.** Build the complete async AI integration architecture against the existing FastAPI mocks, so production is genuinely an API-key-and-URL swap. This is `parameter.md` §3's central directive and is currently 0% built — the backend never calls the ML service at all.

**Components.**
- `ai-gateway/` using `@nestjs/axios`: base URL and API key from `ConfigService`, explicit timeouts, retry with exponential backoff, circuit breaker, typed interfaces mirroring the Pydantic models, error translation to domain exceptions.
- **PII stripping enforced at the gateway boundary** — `parameter.md` §8 forbids sending citizen names or addresses to external LLMs. This must be structural, not a caller responsibility.
- BullMQ triage queue so a slow ML service never blocks submission; explicit `TRIAGE_PENDING` state and a dead-letter queue (D9).
- Emergency bypass (`parameter.md` §6): `is_emergency` → terminal `ROUTED_TO_DEPT`, never entering the innovation queue.
- ML service hardening: shared-secret auth; CORS scoped to the backend (currently `allow_origins=["*"]` with `allow_credentials=True`, an invalid and unsafe pair); FastAPI lifespan replacing deprecated `on_event`; `verify_connectivity()` on startup; `response_model` on all routes; logging; `requirements.txt` pinned with `==`.

**Decisions required first.** D2, D9, and Phase 3.

**Deliverables.** A working gateway, a triage worker, emergency bypass, and a hardened ML service.

**Verification.**
- Stop the ML service — submissions still succeed and land in `TRIAGE_PENDING`; restart it and the backlog drains.
- Inject a 30 s ML delay — the gateway times out and retries; the API stays responsive.
- Assert on a captured payload that no name, phone, or address crosses the boundary.
- An emergency-classified issue never appears in any student-facing query.
- Repointing the gateway's URL and key config at a stub "production" endpoint requires zero code change.

**Risks / assumptions.** The ML service returns hardcoded literals, so triage *quality* is untestable — expected per §3, but it means emergency classification is unvalidated until a real model exists. Keep an admin override path.

---

## Phase 5 — `gates` engine and `projects` domain (G1)

**Goal & scope.** Build the governance mechanism once, generically, then instantiate G1 on it. Four bespoke gate implementations is the failure mode to avoid.

**Components.**
- `projects` module: `projects` table using the documented state vocabulary (`G1_PASSED` → `G2_PASSED` → `G3_PASSED` → `G4_PASSED` → `DEPLOYED` → `DEPLOYED_VERIFIED`), replacing the legacy `verified`/`resolved` enum.
- `gates` module: transition table declaring legal edges, plus a required-evidence predicate per edge. Reusable across G1–G4.
- Append-only `gate_transitions` audit row for every attempt — actor, timestamp, gate, evidence refs, outcome.
- G1 enforced per `parameter.md` §5: blocked unless (≥1 media item **or** ≥2 corroborating reports per D6) **and** `isEmergency === false`. Currently `review()` writes the requested status with no checks at all.
- The flowchart's return / merge / close branch.
- Structured Demand Profile generation.
- Gate endpoints behind `@Roles` + org scope, with `reviewedBy` derived from the JWT and never from the request body.

**Decisions required first.** D3, D6, D7, and Phases 2–4.

**Deliverables.** A reusable gate engine, the `projects` aggregate, working G1, and a complete governance audit trail.

**Verification.**
- Unauthenticated `PATCH /:id/review` returns 401 (today it succeeds).
- A G1 pass on an issue with no media and one report is rejected with a named reason.
- An illegal jump (`SUBMITTED` → `G3_PASSED`) is rejected.
- Every attempt, including failures, writes an audit row.
- Merging two issues yields one profile with both linked and neither lost.

**Risks / assumptions.** D6's corroboration rule needs tuning against real geography — make radius and time window configurable, never hardcoded.

---

## Phase 6 — `hei` and `competencies` domains (G2)

**Goal & scope.** Model the supply side and the readiness-weighted routing that differentiates the project.

**Components.**
- `hei` module: `heis`, `faculty`, `student_teams`, `academic_calendars`, `consortia` (lead + partner HEIs, matching the flowchart's Institutes → Faculty → Students path).
- `competencies` module: taxonomy plus `issue_competencies`; similarity matching via `pgvector` if D2 drops Neo4j.
- `Readiness_Score` excluding HEIs currently in exam windows (`parameter.md` §5).
- G2 enforced: named faculty mentor record, minimum team size, and an **explicit** HEI accept action — auto-accept is forbidden by §5.
- Gen-AI Starter Kit through the Phase 4 gateway (`ml-service/app/gen_ai/`, which `SETUP-GUIDE.md` lists but which does not exist).

**Decisions required first.** D2, D10, and Phase 5.

**Deliverables.** HEI onboarding, readiness routing, consortium formation, working G2, mocked starter kit.

**Verification.**
- An HEI whose calendar shows current exams is excluded from routing candidates.
- G2 without a named mentor is rejected.
- Auto-accept is impossible — an explicit accept call is required.
- Starter-kit generation carries no PII in its payload.

**Risks / assumptions.** Academic calendar data must be entered by a human. Provide admin CRUD plus a seed, or readiness routing silently degrades to "everyone is ready."

---

## Phase 7 — `funding`, `notifications`, `intake-channels` (G3/G4)

**Goal & scope.** Close the loop: funding, pilot sign-off, community ownership, and the long-horizon check-in.

**Components.**
- `funding` module: `escrow_transactions(project_id, funder_id, amount, tranche_condition, status, released_at)` exactly as `parameter.md` §4 specifies; `PaymentGatewayClient` interface + `MockPaymentGateway` behind a DI token; integer paise, never floats.
- Tranche release subscribed to `G3_PASSED` / `G4_PASSED` **events** — §4 explicitly forbids release on manual admin override alone — with the triggering gate event logged on every release.
- G3: dual digital signature records (citizen + government tester) and ≥1 pilot evidence upload.
- G4: maintenance-owner entity, uploaded maintenance plan, scheduled `6_month_check_in`. `DEPLOYED` is **not** terminal; only `DEPLOYED_VERIFIED` is.
- BullMQ repeatable jobs: the 6-month check-in, and the 30-day `UNASSIGNED` → `bounty_multiplier` increment (§7).
- `notifications` module: `NotificationProvider` interface + mock (D8).
- `intake-channels`: WhatsApp/voice webhook adapters with signature verification, feeding `issues`.
- Industry accounts gated on admin verification before entering the matching pool.

**Decisions required first.** D8, D11, and Phases 5–6.

**Deliverables.** Escrow ledger, gate-triggered tranche release, working G3/G4, a running job queue, notification abstraction.

**Verification.**
- An admin cannot release funds without a gate event — the attempt is refused and audited.
- Every release row references its triggering transition.
- A `DEPLOYED` project is not counted as a success in any query.
- With the check-in interval configured to minutes, the job fires and moves the project to `DEPLOYED_VERIFIED`.
- An issue aged past 30 days has its multiplier incremented exactly once.

**Risks / assumptions.** Repeatable jobs need at-least-once handling — the check-in must be idempotent. "Digital signature" here means an authenticated, audited attestation record, not cryptographic signing, unless decided otherwise. WhatsApp Business API approval is on an external timeline; the provider interface makes the channel swappable.

---

## Phase 8 — `reporting` domain

**Goal & scope.** Read-side features: government impact dashboard, leaderboard, and incentives.

**Components.**
- Materialised views or scheduled rollups for problem density by district / category / time — the deterministic version of the "predictive engine", with the ML variant mocked behind the Phase 4 gateway.
- Jharkhand Innovation League leaderboard ranked on solutions surviving the 6-month check-in, not on submission count.
- `impact_points` awarded on `G4_PASSED` / `DEPLOYED_VERIFIED` only (`parameter.md` §7).
- Innovation Passport.
- Credentials as signed verifiable credentials per D12, with a public verify endpoint.
- Citizen rating/feedback and before/after media (from the flowchart).
- PostGIS if geospatial queries require it.

**Decisions required first.** D12 and Phase 7.

**Deliverables.** Dashboard aggregation APIs, leaderboard, impact points, verifiable credentials.

**Verification.**
- A project at `PROPOSAL_SUBMITTED` earns zero points.
- Leaderboard rank changes only when a project reaches `DEPLOYED_VERIFIED`.
- A dashboard query over 100k seeded issues returns within the stated budget.
- An issued credential verifies against the public endpoint and fails after tampering.

**Risks / assumptions.** Dashboards over unindexed aggregates degrade quickly — profile against realistic seed volume, not 20 rows.

---

## Phase 9 — Production readiness

**Goal & scope.** Make the system deployable, observable, and defensible.

**Components.**
- Dockerfiles for backend and ml-service; full `docker-compose` (Postgres, Redis, MinIO, ML service, backend). Compose currently starts Postgres only, and no Dockerfiles exist.
- Real deploy target per D14.
- Load testing on intake and dashboard paths at realistic volume; index tuning from actual query plans.
- Metrics, alerting, log aggregation.
- Backup and restore rehearsal — actually restore, do not merely configure.
- Migration rollback rehearsal.
- Dependency audit and an end-to-end security pass, including a re-audit of §8 PII masking across every endpoint added since Phase 3.
- Test coverage targeted at the `gates` and `funding` modules — where a bug is a governance failure, not a cosmetic one.
- Runbook, and a generated OpenAPI client for the incoming frontend team (D13).

**Decisions required first.** D13, D14, and all prior phases.

**Deliverables.** Reproducible deployment, load-test results, security review, restore-tested backups, generated API client.

**Verification.**
- A clean clone reaches a running full stack with one command.
- Load test meets the stated target.
- A restore from backup produces a working database.
- No high-severity findings outstanding.
- Every endpoint's PII exposure is explicitly reviewed against §8.

**Risks / assumptions.** Assumes a deploy target exists by now. If D14 is still open, this phase cannot start.

---

## Cutting guidance

If time runs short, cut from the bottom. Phases 0–2 are the cheapest they will ever be right now, and every later phase inherits their defects. The gated governance model with `DEPLOYED_VERIFIED` as the only terminal success state is the project's differentiator and should be the last thing cut; the knowledge graph, blockchain credentials, and predictive ML are the parts most likely to consume time without improving the outcome.
