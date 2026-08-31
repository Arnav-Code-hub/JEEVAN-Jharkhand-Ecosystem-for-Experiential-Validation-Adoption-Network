# ADR-0014: Where the system is deployed

- **Status:** **Accepted** — Docker Compose on a cloud VM (AWS EC2, ap-south-1)
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 1 - config strategy, and Phase 9

## Context

No document names a deployment target. This determines the configuration strategy, whether Redis and object storage are available as managed services, how secrets are injected, and whether the Neo4j Aura free tier is viable. Several later decisions cannot be finalised without it.

## Recommendation

Decide before Phase 1 begins. A single container host running the docker-compose stack is sufficient for a demo and keeps configuration uniform between local and deployed environments.

## Decision

**Docker Compose on a cloud VM — AWS EC2, Mumbai region (`ap-south-1`).**

Rationale given at decision time: `ap-south-1` keeps citizen data in-country, consistent with the
MeitY data-localisation requirement in `parameter.md` §8. Running the same Compose stack locally and
on the VM keeps configuration uniform and removes an entire class of "works locally" failure.

Consequences now binding:
- Configuration is injected as environment variables into containers; no cloud-specific secret
  manager is assumed in Phase 1.
- Postgres, Redis, and MinIO all run as containers on the VM rather than as managed services, so
  their durability is the VM's durability. Phase 9 must cover volume backups explicitly.
- Single-host deployment means no horizontal scaling in this project's timeline. In-memory state is
  still forbidden (OTP already moves to Redis in Phase 2) so that this stays a deployment choice
  rather than an architectural one.

## Consequences if accepted

Fixes the secret-injection mechanism that Phase 1's config validation is built around. Deferring it means Phase 1 config work may be redone.

## Alternatives considered

Serverless or managed PaaS per service: more moving parts and per-service configuration divergence for no demo-visible benefit.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
