# ADR-0008: Notification channels and provider

- **Status:** Proposed — awaiting decision
- **Date:** 2026-08-31
- **Blocks:** Phase 7

## Context

The documents promise automated status updates to citizens, proactive alerts to government departments, and AI co-pilot risk flags to students. No channel, provider, template store, delivery-status tracking, or per-language template strategy is specified anywhere.

## Recommendation

A channel-agnostic NotificationProvider interface with a MockNotificationProvider that logs. Templates stored per language (hi/en/sat). Real SMS/WhatsApp providers swap in behind the same interface, matching the mock-first rule in parameter.md sections 3 and 4.

## Consequences if accepted

Notification logic is testable without any external account. Delivery-status tracking must be designed into the interface up front or it cannot be added without changing every caller.

## Alternatives considered

Direct provider SDK calls at each call site: fastest to write, impossible to test or swap. Rejected by the project's own mock-first rule.

---

*Change Status to `Accepted` or `Rejected` once decided, and record the date. If rejected, note what was chosen instead — the affected phase in `implementation_plan.md` changes accordingly.*
