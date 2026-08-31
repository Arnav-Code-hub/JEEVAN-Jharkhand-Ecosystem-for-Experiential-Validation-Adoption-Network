# ADR-0015: Whether data is scoped per district

- **Status:** **Accepted** — Scoped by org_unit_id; explicit state-level role sees all
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted) (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 2 - every query, guard, and index

## Context

It is not stated anywhere whether a District Innovation Officer in Ranchi should be able to see Dumka's review queue. The answer changes every list query, every guard, and every index in the system, and it is far cheaper to decide before the queries exist.

## Recommendation

Yes - scope by org_unit derived from the JWT, enforced by an OrgScopeGuard, with an explicit state-level role that can see across districts. Treat cross-district visibility as a privilege, not the default.

## Decision

**Data is scoped by `org_unit_id` (Option A).**

A government officer sees only records within their own org unit and its descendants. An explicit
state-level role (`GOVT_STATE_ADMIN`) sees across all districts. Scope is derived from the JWT and
enforced by an `OrgScopeGuard` plus a scope predicate on every list query - never from a
client-supplied parameter.

Rationale given at decision time: building scoping into the first query is far cheaper than
retrofitting it across twenty endpoints later, and statewide visibility of citizen phone numbers and
street addresses is difficult to defend under `parameter.md` section 8 and MeitY localisation.

Consequences now binding:
- `users.org_unit_id` is required for every government-role account.
- Indexes on scoped tables must include `org_unit_id`.
- Cross-district access requires the state-level role; per-user grants (Option C) are explicitly out
  of scope for now.

## Decision

**Data is scoped by `org_unit_id` (Option A).**

A government officer sees only records within their own org unit and its descendants. An explicit
state-level role (`GOVT_STATE_ADMIN`) sees across all districts. Scope is derived from the JWT and
enforced by an `OrgScopeGuard` plus a scope predicate on every list query - never from a
client-supplied parameter.

Rationale given at decision time: building scoping into the first query is far cheaper than
retrofitting it across twenty endpoints later, and statewide visibility of citizen phone numbers and
street addresses is difficult to defend under `parameter.md` section 8 and MeitY localisation.

Consequences now binding:
- `users.org_unit_id` is required for every government-role account.
- Indexes on scoped tables must include `org_unit_id`.
- Cross-district access requires the state-level role; per-user grants (Option C) are explicitly out
  of scope for now.

## Consequences if accepted

Prevents an entire class of data-exposure bug and aligns with the PII constraints in parameter.md section 8. Every list query must carry the scope predicate, and indexes must include org_unit.

## Alternatives considered

Global visibility for all government roles: simpler, but exposes citizen PII far more widely than section 8 permits. Rejected.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
