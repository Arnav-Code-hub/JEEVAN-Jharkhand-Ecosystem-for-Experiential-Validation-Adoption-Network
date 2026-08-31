# ADR-0007: Which body owns the G1 gate

- **Status:** **Accepted** — Tiered org_units; G1 owner set by configuration
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted) (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 2 - RBAC and org model

## Context

The flowchart makes Grampanchayat the filtration / AI-filtration / PS-assignment authority. parameter.md section 5 and Final_Merged_Workflow.md make the District Innovation Cell the G1 owner, with Panchayat appearing only at G4 as the maintenance owner. These are different bodies at different administrative tiers and the documents contradict each other.

## Recommendation

Model org_units with an explicit tier (state / district / block / panchayat / HEI) so both bodies are representable, and record the G1 owner as configuration rather than hardcoding a tier. Then pick one as the default for the demo.

## Decision

**Model `org_units` as an explicit tier hierarchy and make the G1-owning tier configuration
(Option C).**

Tiers: `STATE` then `DISTRICT` then `BLOCK` then `PANCHAYAT`, plus `HEI` as a non-territorial unit.
Each unit carries an optional `parentId`, forming a tree.

The gate owner is read from configuration (`G1_OWNER_TIER`), defaulting to `DISTRICT` to match
`parameter.md` section 5. Setting it to `PANCHAYAT` reproduces the flowchart's Grampanchayat model
with no code change.

Rationale given at decision time: the flowchart and `parameter.md` name different bodies at
different administrative tiers. Encoding the owning tier as data rather than as a hardcoded role
removes the contradiction from the code even before the documents are reconciled, and the hierarchy
is needed for ADR-0015 regardless.

Consequences now binding:
- `users.org_unit_id` references a tier-typed unit; scope checks walk the tree.
- The source documents still disagree and should eventually be reconciled, but that is no longer a
  blocker for implementation.

## Decision

**Model `org_units` as an explicit tier hierarchy and make the G1-owning tier configuration
(Option C).**

Tiers: `STATE` then `DISTRICT` then `BLOCK` then `PANCHAYAT`, plus `HEI` as a non-territorial unit.
Each unit carries an optional `parentId`, forming a tree.

The gate owner is read from configuration (`G1_OWNER_TIER`), defaulting to `DISTRICT` to match
`parameter.md` section 5. Setting it to `PANCHAYAT` reproduces the flowchart's Grampanchayat model
with no code change.

Rationale given at decision time: the flowchart and `parameter.md` name different bodies at
different administrative tiers. Encoding the owning tier as data rather than as a hardcoded role
removes the contradiction from the code even before the documents are reconciled, and the hierarchy
is needed for ADR-0015 regardless.

Consequences now binding:
- `users.org_unit_id` references a tier-typed unit; scope checks walk the tree.
- The source documents still disagree and should eventually be reconciled, but that is no longer a
  blocker for implementation.

## Consequences if accepted

Removes the contradiction from the code even before it is resolved in the documents. Requires the org_unit hierarchy in Phase 2 rather than later.

## Alternatives considered

Hardcode District Innovation Cell: matches parameter.md but contradicts the flowchart the stakeholders drew. Hardcode Grampanchayat: the reverse. Both are rejected in favour of making the tier explicit.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
