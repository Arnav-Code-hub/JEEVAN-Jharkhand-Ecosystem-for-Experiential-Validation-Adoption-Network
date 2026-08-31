# ADR-0009: Synchronous vs. asynchronous AI calls, and the failure fallback

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-31
- **Blocks:** Phase 4 - ai-gateway design

## Context

parameter.md section 3 requires the full asynchronous request/response infrastructure for all AI calls. Triage runs on the citizen intake path, which must stay fast and must not fail when the ML service is slow or down. No fallback state is currently defined.

## Recommendation

Asynchronous via a BullMQ queue. Intake persists immediately with an explicit TRIAGE_PENDING state, a worker calls the gateway, and failures land in a dead-letter queue for retry. The gateway enforces timeouts, backoff, and a circuit breaker.

## Consequences if accepted

A citizen submission never fails because the ML service is unavailable. Requires Redis (already required by ADR-0004 for OTP). Introduces an intermediate state that every consumer must handle.

## Alternatives considered

Synchronous calls inside the request: simplest, but couples citizen intake availability to ML service availability and contradicts section 3. Rejected.

---

*Change Status to `Accepted` or `Rejected` once decided, and record the date. If rejected, note what was chosen instead — the affected phase in `implementation_plan.md` changes accordingly.*
