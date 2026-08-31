# Architecture Decision Records

Each ADR records one open architectural decision, its recommendation, and its trade-offs.

**11 of 16 are `Accepted`; the remaining 5 are `Proposed`.** They correspond to the decision register in
[`implementation_plan.md`](../../implementation_plan.md). Decide each one, set its Status,
then proceed with the phase it blocks.

**Blocking Phase 1:** ADR-0001, ADR-0014, ADR-0016 — all **decided**, Phase 1 unblocked.
**Blocking Phase 2:** ADR-0004, ADR-0007, ADR-0010, ADR-0015 — all **decided**, Phase 2 unblocked.

| ADR | Decision | Status | Blocks |
|---|---|---|---|
| [ADR-0001](./0001-supabase-vs-self-hosted-postgres.md) | Supabase vs. self-hosted PostgreSQL | **Accepted** — Self-hosted PostgreSQL via Docker Compose | Phase 1 - all schema work |
| [ADR-0002](./0002-neo4j-vs-pgvector.md) | Neo4j vs. PostgreSQL + pgvector for competency matching | **Accepted** — Neo4j dropped; PostgreSQL + pgvector | Phase 4 and Phase 6 |
| [ADR-0003](./0003-issue-vs-project-aggregate.md) | Is Issue the same aggregate as Project? | **Accepted** — Separate aggregates + link table | Phase 3 and Phase 5 - and indirectly everything |
| [ADR-0004](./0004-token-issuer-and-rbac.md) | Who issues and verifies session tokens | **Accepted** — NestJS JWTs; access + refresh in Redis | Phase 2 - auth, RBAC, every guard |
| [ADR-0005](./0005-object-storage-and-upload-flow.md) | Object storage provider and upload flow | **Accepted** — MinIO/S3, presigned direct upload | Phase 3 - issues completion |
| [ADR-0006](./0006-corroboration-detection.md) | How corroborating reports are detected | **Accepted** — Geo-radius + category + time window | Phase 5 - G1 enforcement |
| [ADR-0007](./0007-governance-body-for-g1.md) | Which body owns the G1 gate | **Accepted** — Tiered org_units; G1 owner via config | Phase 2 - RBAC and org model |
| [ADR-0008](./0008-notification-channels.md) | Notification channels and provider | Proposed | Phase 7 |
| [ADR-0009](./0009-ai-call-sync-vs-async.md) | Synchronous vs. asynchronous AI calls, and the failure fallback | Proposed | Phase 4 - ai-gateway design |
| [ADR-0010](./0010-master-data-source.md) | Source for districts, blocks, panchayats, and the HEI list | **Accepted** — Districts+blocks seeded; HEI seed + admin CRUD | Phase 2 |
| [ADR-0011](./0011-money-representation-and-escrow-scope.md) | Money representation and whether escrow stays mocked | Proposed | Phase 7 |
| [ADR-0012](./0012-credential-format.md) | Blockchain badges vs. signed verifiable credentials | Proposed | Phase 8 |
| [ADR-0013](./0013-monorepo-tooling-and-shared-types.md) | Monorepo tooling and the shared-type mechanism | Proposed | Phase 9 - frontend handoff |
| [ADR-0014](./0014-deployment-target.md) | Where the system is deployed | **Accepted** — Docker Compose on AWS EC2 ap-south-1 | Phase 1 - config strategy, and Phase 9 |
| [ADR-0015](./0015-district-level-data-scoping.md) | Whether data is scoped per district | **Accepted** — Scoped by org_unit_id; state role sees all | Phase 2 - every query, guard, and index |
| [ADR-0016](./0016-api-versioning-and-contract-style.md) | API versioning and contract style | **Accepted** — URI path versioning, NestJS native | Phase 1 - all controllers |

## Deviations from documented requirements

Three ADRs recommend departing from something the project documents currently mandate.
Each needs explicit sign-off, and if rejected the affected phase changes:

- ~~**ADR-0002** recommends dropping Neo4j~~ — **accepted 2026-08-31**; `parameter.md` §1 amended.
- **ADR-0012** recommends signed verifiable credentials instead of blockchain badges.
- **ADR-0011** treats the escrow money-movement layer as permanently mocked.
