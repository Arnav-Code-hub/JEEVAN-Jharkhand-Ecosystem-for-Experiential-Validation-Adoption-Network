# ADR-0010: Source for districts, blocks, panchayats, and the HEI list

- **Status:** **Accepted** — Seed districts + blocks now, panchayats later; HEI seed + admin CRUD
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted) (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 2

## Context

Routing, org scoping, dashboards, and the HEI email allowlist all depend on reference data that does not exist. district and block are currently free-text varchar columns on the issue, which will produce 'Ranchi', 'ranchi', and 'RANCHI' as three distinct districts within a week.

## Recommendation

Seed org_units from the official Jharkhand administrative list via a versioned seed migration, and normalise the issue's district/block into foreign keys. Maintain the HEI allowlist as admin-editable data seeded from the same migration.

## Decision

**Administrative units - Option B.** Seed all 24 Jharkhand districts and their blocks now.
Panchayats are deferred to Phase 7 (G4 work); the schema supports them without change.

**HEI allowlist - Option A.** Ship a seed of real Jharkhand institutions with their email domains,
plus admin CRUD endpoints so more can be added without a deploy.

Rationale given at decision time: districts and blocks are needed immediately for org scoping and
for the Block/District exposure rule in `parameter.md` section 8, whereas roughly 4,300 panchayat
rows are not needed until much later. Seeding the HEI list means student registration works out of
the box.

Consequences now binding:
- `issues.district` / `issues.block` become foreign keys to `org_units`. That conversion happens in
  Phase 3, when the `issues` aggregate is reworked.
- Seed data lives in versioned JSON under `src/db/seeds/data/`, not in code, so correcting it is a
  data change rather than a code change.
- Seeds must be idempotent so they can be re-run as the data is corrected.

**Data provenance caveat:** the district list is authoritative (24 districts). The block list is
compiled best-effort from public sources and is explicitly flagged in the seed file as requiring
verification against the official Jharkhand government source before any production or judged
use.

## Decision

**Administrative units - Option B.** Seed all 24 Jharkhand districts and their blocks now.
Panchayats are deferred to Phase 7 (G4 work); the schema supports them without change.

**HEI allowlist - Option A.** Ship a seed of real Jharkhand institutions with their email domains,
plus admin CRUD endpoints so more can be added without a deploy.

Rationale given at decision time: districts and blocks are needed immediately for org scoping and
for the Block/District exposure rule in `parameter.md` section 8, whereas roughly 4,300 panchayat
rows are not needed until much later. Seeding the HEI list means student registration works out of
the box.

Consequences now binding:
- `issues.district` / `issues.block` become foreign keys to `org_units`. That conversion happens in
  Phase 3, when the `issues` aggregate is reworked.
- Seed data lives in versioned JSON under `src/db/seeds/data/`, not in code, so correcting it is a
  data change rather than a code change.
- Seeds must be idempotent so they can be re-run as the data is corrected.

**Data provenance caveat:** the district list is authoritative (24 districts). The block list is
compiled best-effort from public sources and is explicitly flagged in the seed file as requiring
verification against the official Jharkhand government source before any production or judged
use.

## Consequences if accepted

Reference data becomes reviewable and diffable in version control. Someone must source the authoritative district/block/panchayat list; this is a data-gathering dependency, not a coding one.

## Alternatives considered

Free-text with normalisation at query time: cheap now, produces unjoinable dashboards later. Rejected.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
