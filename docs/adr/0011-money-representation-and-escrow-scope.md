# ADR-0011: Money representation and whether escrow stays mocked

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-31
- **Blocks:** Phase 7

## Context

parameter.md section 4 specifies a real persisted escrow ledger with a mocked payment gateway behind a PaymentGatewayClient interface. Real money movement additionally requires KYC, a payment aggregator relationship, and compliance work well outside this project's scope and timeline.

## Recommendation

Represent all amounts as integer paise, never floating point. Treat escrow as permanently mocked for the lifetime of this project, and state that plainly in the README so nobody plans around it.

## Consequences if accepted

The ledger and tranche-release logic remain real, auditable, and demonstrable; only the money movement is simulated. Switching to a real gateway later is an interface implementation, not a refactor.

## Alternatives considered

Floating-point amounts: rejected outright - rounding errors in a financial ledger are unacceptable. Integrating a real gateway now: out of scope and blocked on external compliance.

---

*Change Status to `Accepted` or `Rejected` once decided, and record the date. If rejected, note what was chosen instead — the affected phase in `implementation_plan.md` changes accordingly.*
