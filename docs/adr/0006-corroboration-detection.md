# ADR-0006: How corroborating reports are detected

- **Status:** **Accepted** — Geo-radius + category + time window, admin-confirmed
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 5 - G1 enforcement

## Context

parameter.md section 5 requires G1 evidence sufficiency to be at least one media item OR two corroborating reports. Nothing anywhere defines how two independent citizen submissions are recognised as describing the same problem. Without this rule G1 cannot be enforced as specified.

## Recommendation

Deterministic candidate matching on geo-radius + category + time window, surfaced to the reviewing officer for confirmation rather than auto-merged. Radius and window must be configuration, not constants.

## Decision

**Corroborating reports are matched by category, geographic radius, and time window (Option B).**

Defaults: 500 m radius, 30-day window, both configurable via `CORROBORATION_RADIUS_METRES` and
`CORROBORATION_WINDOW_DAYS`. Distance is computed with a haversine expression in SQL; PostGIS is not
required for a single-radius filter at this data volume and can be added later if the predictive
work in Phase 8 wants real geometry.

Reports without coordinates - common from WhatsApp and voice intake - fall back to matching on the
same block and category.

Rationale given at decision time: a block is far too coarse to mean "the same problem"; two
unrelated hand pumps 8 km apart would have corroborated each other under the previous rule. Matching
is surfaced to the reviewing officer as evidence for a G1 decision rather than auto-merging, so a
bad match can never silently promote an issue.

Consequences now binding:
- A partial index on `(category, createdAt)` where coordinates are present supports the query.
- The radius and window are tuning parameters that should be revisited against real Jharkhand
  geography; a dense urban ward and a sparse rural block will not want the same radius.
- Embedding-based clustering (Option C) stays out of scope while the ML service returns mocks.

## Consequences if accepted

Makes G1's second evidence path enforceable and gives the reviewer control over merges. Needs tuning against real Jharkhand geography; a radius that works in Ranchi may not work in a sparse block.

## Alternatives considered

AI/embedding-based clustering: better recall, but unverifiable while the ML service returns mocks, and a wrong auto-merge destroys a citizen's report. Defer to a later phase.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
