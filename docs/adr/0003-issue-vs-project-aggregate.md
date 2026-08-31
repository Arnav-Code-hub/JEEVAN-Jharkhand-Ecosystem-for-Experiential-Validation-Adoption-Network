# ADR-0003: Is Issue the same aggregate as Project?

- **Status:** **Accepted** — separate aggregates joined by a link table
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 3 and Phase 5 - and indirectly everything

## Context

The workflow shows a citizen Issue passing G1, becoming a Structured Demand Profile, then a Project at G2. The flowchart's G1 branch explicitly includes 'Return / Merge / Close', meaning several citizen reports can merge into one profile. The current single flat issues table with a status enum cannot represent a merge, nor one project spanning many reports.

## Recommendation

Separate aggregates. Keep issues as raw citizen reports; introduce a demand profile / project aggregate joined by an issue_links table. An Issue's lifecycle ends at G1; a Project's begins there.

## Decision

**`Issue` and `Project` are separate aggregates, joined by a `project_issues` link table.**

An Issue is a raw citizen report; its lifecycle ends at G1. A Project is the Structured Demand
Profile that G1 creates, and it carries the G1-to-G4 state machine. The link table records every
issue attached to a project, with exactly one flagged primary (enforced by a partial unique index),
which is what makes the flowchart's G1 "Return / Merge / Close" branch expressible.

Adopted as the basis of the Phase 3 implementation at the owner's direction to build the Project
entity. **Ratify or request a change before these tables carry real data** - altering the aggregate
boundary later is a rewrite of every downstream module.

Consequences now binding:
- `projects.originIssueId` is the primary origin; merges are additional `project_issues` rows.
- Project state uses the documented vocabulary, with `DEPLOYED` explicitly non-terminal.
- `gate_transitions` attaches to a project, so a **failed G1 has no project row** to attach to and
  is captured in `audit_log` instead.

## Consequences if accepted

Merge, return, and close all become expressible. Requires a migration and a second aggregate before G1 can be enforced properly. Getting this wrong later is a full rewrite of every downstream module.

## Alternatives considered

Single table with a status enum: simplest today, but cannot express merge and forces per-role columns onto one row. Rejected.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
