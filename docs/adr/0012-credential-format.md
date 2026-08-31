# ADR-0012: Blockchain badges vs. signed verifiable credentials

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-31
- **Blocks:** Phase 8

## Context

The solution approach specifies blockchain-verified micro-credentials issued on G4 pass. The functional requirement is that an employer can independently verify a student genuinely completed a deployed project.

## Recommendation

Issue signed W3C Verifiable Credentials (JWT-based) with a public verification endpoint. Same verifiable claim, no chain, no gas, no wallet onboarding for students.

## Consequences if accepted

Delivers the employer-verification outcome in a fraction of the effort and with no external infrastructure. Deviates from a documented requirement, so it needs explicit sign-off. Loses decentralised issuance, which no stated requirement actually asks for.

## Alternatives considered

On-chain badges: high infrastructure and operational cost, requires student wallet onboarding in a low-digital-literacy population. Rejected on cost/benefit.

---

*Change Status to `Accepted` or `Rejected` once decided, and record the date. If rejected, note what was chosen instead — the affected phase in `implementation_plan.md` changes accordingly.*
