# ADR-0013: Monorepo tooling and the shared-type mechanism

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-31
- **Blocks:** Phase 9 - frontend handoff

## Context

The repository is a monorepo in shape but has no workspace tooling, no root package.json, and no CI. A /shared/types directory was specified to hold TypeScript interfaces shared between the backend and the web app, but it was empty and there was no mechanism - path mapping, workspace link, or build step - by which anything could import from it. It has been removed.

## Recommendation

Do not hand-maintain shared types. Generate a typed client from the backend's OpenAPI document using openapi-typescript, so the incoming frontend always has exact, current types. Adopt pnpm workspaces only if a second Node package genuinely needs to share code.

## Consequences if accepted

The API contract has a single source of truth - the controllers - and cannot drift. Requires the OpenAPI document to stay accurate, which Swagger decorators already handle.

## Alternatives considered

Hand-written shared interfaces: drift from the implementation the first time someone is in a hurry. Rejected.

---

*Change Status to `Accepted` or `Rejected` once decided, and record the date. If rejected, note what was chosen instead — the affected phase in `implementation_plan.md` changes accordingly.*
