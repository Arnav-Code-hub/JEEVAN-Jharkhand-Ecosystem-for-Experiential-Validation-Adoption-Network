# ADR-0016: API versioning and contract style

- **Status:** **Accepted** — URI path versioning via NestJS native versioning
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 1 - all controllers

## Context

There is currently no global route prefix and no versioning. Until the recent restructure, every route was also exposed under two unrelated prefixes. The incoming frontend needs a stable, documented contract.

## Recommendation

Adopt an /api/v1 global prefix and code-first OpenAPI generated from the existing Swagger decorators. Publish a generated client for the frontend (see ADR-0013). Version by URL path, and only on breaking changes.

## Decision

**URI path versioning using NestJS's native versioning support**, with a global `api` prefix.

Implementation: `app.setGlobalPrefix('api')` plus
`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, producing routes of the
form `/api/v1/<resource>`. Controllers declare only their resource path (`@Controller('issues')`);
the prefix and version are applied globally, so no controller hardcodes `api/` or `v1/`.

Consequences now binding:
- Existing routes move: `api/auth/*` becomes `/api/v1/auth/*`, `api/issues/*` becomes
  `/api/v1/issues/*`. Safe to do now because the frontend is being replaced.
- Version bumps happen only on breaking changes, and per-controller overrides are possible via
  `@Version()` when a single endpoint needs to diverge.
- The OpenAPI document generated from the Swagger decorators remains the single source of truth for
  the contract, per ADR-0013.

## Consequences if accepted

One canonical path per resource and a machine-readable contract. Requires a one-time route change, which is safe now because the frontend is being replaced.

## Alternatives considered

Design-first OpenAPI with generated server stubs: stronger contract discipline, but heavy for a team this size and duplicative of the decorators already in place.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
