# ADR-0001: Supabase vs. self-hosted PostgreSQL

- **Status:** **Accepted** — Self-hosted PostgreSQL via Docker Compose
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 1 - all schema work

## Context

Three persistence stories currently coexist and none is authoritative. README described Supabase Auth + Supabase Postgres; docker-compose.yml runs plain Postgres; app.module.ts uses TypeORM against plain Postgres; .env carries an unused SUPABASE_JWT_SECRET; the supabase/migrations directory was empty and has been removed. Nothing in the repository actually uses Supabase.

## Recommendation

Drop Supabase. Use Docker Postgres locally and a managed Postgres in deployment. If managed convenience is wanted later, Supabase can be adopted as managed Postgres + object storage only, never as the auth provider (see ADR-0004).

## Decision

**Self-hosted PostgreSQL, run via Docker Compose.** Supabase is dropped entirely — not used as a
database, not used for auth, not used for storage.

Rationale given at decision time: it avoids the dual-auth conflict between Supabase Auth and the
NestJS-issued JWTs required by ADR-0004, and it keeps strict control over where citizen PII lives,
which matters for the MeitY localisation constraint in `parameter.md` §8.

Consequences now binding:
- TypeORM connects to a plain PostgreSQL instance; connection settings come from validated env config.
- The `supabase/` directory and all `SUPABASE_*` environment variables are removed.
- Object storage must be solved independently — see ADR-0005 (S3-compatible, MinIO locally).
- Backups become our responsibility rather than a managed service's — see Phase 9.

## Consequences if accepted

One database story, one connection path, one migration mechanism. Object storage must then be chosen separately (ADR-0005). Removes a dependency that was configured but never used.

## Alternatives considered

Adopt Supabase fully: would mean rewriting the TypeORM data access and accepting Supabase Auth's constraints around HEI domain allowlists, industry manual verification, and admin TOTP. Half-adopting it - the current state - is the worst option and should not continue.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
