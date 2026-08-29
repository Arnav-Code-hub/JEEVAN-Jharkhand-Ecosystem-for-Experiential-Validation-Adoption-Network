# AI Core Parameters & Guardrails
**Project:** Societal Innovation Collaboration Portal (Jharkhand)
**Objective:** Build a scalable, NEP-2020 aligned, closed-loop innovation ecosystem.

## 0. Build Sequencing (READ THIS FIRST)
Do not attempt to build all four modules and all four gates in a single pass. Build in this order, and treat each step as a working, testable slice before moving to the next:

1. **Citizen/User Module** — intake form, geotagging, offline sync, status tracking, phone+OTP auth.
2. **Government/Admin Module + Gate G1** — District Innovation Cell review queue, Structured Demand Profile generation, emergency bypass rule.
3. **Student/University Module + Gate G2** — HEI onboarding, readiness-weighted routing, consortium formation, Gen-AI Starter Kit (mocked).
4. **Industry/CSR Module + Escrow (mocked) + Gates G3/G4** — matchmaking, project charter, pilot sign-off, community handoff, ownership transfer.
5. **Predictive Engine, Gamification, Leaderboard, Blockchain Badges** — build last, only once the core pipeline above is functional end-to-end.

If a request asks for "the whole platform," build module 1 first and confirm before proceeding to the next.

## 1. Architectural Directives & Code Structure (STRICT MODULARITY)
*   **Tech Stack Strict Adherence:** You must exclusively use [Next.js/React] for the web portal, [Flutter] for the mobile app, [Node.js/NestJS] for the backend API, and [Python/FastAPI] for the AI/ML microservices.
*   **Role-Based Modular Architecture:** Do NOT hardcode the platform into a single monolithic codebase or single massive UI file. You must structure the codebase with strict separation of concerns for the four primary stakeholders:
    1.  **Citizen / User Module**
    2.  **Student / University Module**
    3.  **Government / Admin Module**
    4.  **Industry / CSR Module**
*   **Separated UIs:** Each stakeholder must have their own distinct, dedicated UI components, dashboards, and routing logic, properly linked through a central Role-Based Access Control (RBAC) system.
*   **Target Directory Structure:** Follow this shape (adapt file extensions to the framework in use, but preserve the module boundaries):

```
/backend
  /src
    /modules
      /citizen        # intake, status tracking, offline sync endpoints
      /student         # HEI workspace, consortium, starter kit
      /government       # admin review, gates G1-G4, dashboards
      /industry         # matchmaking, escrow, IP workflows
      /shared           # RBAC, auth, notification layer, audit logging
    /ai-gateway         # async client wrappers for all AI/ML calls (mocked in dev)
    /db
      /postgres          # relational schemas (users, projects, gate states, escrow ledger)
      /graph             # Neo4j schema/queries (competency knowledge graph)
/ml-service              # Python/FastAPI — triage, extraction, prediction (mocked responses in dev)
/web                     # Next.js — role-aware routing, one dashboard tree per role
/mobile                  # Flutter — citizen + student facing, offline-first
```

*   **Database Constraints:** Use **PostgreSQL** for all relational data — users, project states, gate records, escrow ledger entries. Use **Neo4j** (definitive choice, not MongoDB) for the Competency Demand/Supply Knowledge Graph. Do not split this responsibility between two databases; MongoDB is not used in this architecture.
*   **Offline-First & Accessibility:** The mobile frontend must support offline caching. UI must be designed assuming low-bandwidth environments, must support multi-language toggles (Hindi, English, Santali), and must meet WCAG 2.1 AA basics (screen-reader labels, sufficient contrast, keyboard/voice navigability) for the web portal.

## 2. Authentication & Identity
*   **Citizens:** Phone number + OTP only. No email/password flow — assume most users are on WhatsApp/mobile and have low tolerance for account creation friction. Allow anonymous draft submission that gets bound to a verified phone number before final submit.
*   **Students & Faculty:** Institutional email + OTP, verified against a whitelisted HEI domain list maintained by the Government/Admin module.
*   **Industry/CSR partners:** Email + OTP, with a manual verification step by an admin before the account is marked "active" and eligible for matching (prevents fake industry accounts from entering the matching pool).
*   **Government/Admin roles:** Email + OTP plus mandatory 2FA (TOTP app), given elevated access to PII and gate-approval authority.
*   All sessions issue short-lived JWTs with role claims consumed by the RBAC layer; do not embed PII in the JWT payload.

## 3. External AI & API Integration (CRITICAL FOR DEVELOPMENT)
*   **Mock APIs, Real Architecture:** All AI-driven tasks (Triage, Competency Extraction, Gen-AI Starter Kit generation, Predictive Engine) will eventually be handled via external LLM/ML API keys. **For the current development phase, you must use FAKE/MOCK APIs.**
*   **NO Simulation Bypasses:** Do NOT write hardcoded simulation logic that bypasses standard API architecture. You must build the full asynchronous request/response infrastructure, including proper payload structuring, HTTP headers, timeout handling, and error catching. Simply point the endpoints to a mock service (or return dummy JSON via a mock controller). The goal is that transitioning to production only requires swapping out the API Key and Endpoint URL, with zero structural refactoring.

## 4. Payments & Escrow (Also Mocked in Development)
*   **Do not integrate a real payment gateway yet.** Build the escrow ledger as a real, persisted PostgreSQL table (`escrow_transactions`: project_id, funder_id, amount, tranche_condition, status, released_at) with a real service layer for deposit/hold/release logic.
*   Wrap the actual money-movement call behind a `PaymentGatewayClient` interface with a mock implementation (`MockPaymentGateway`) that simulates success/failure. Production will swap in a real gateway (e.g., Razorpay Route) behind the same interface — zero structural refactoring, same pattern as the AI mock rule above.
*   Tranche release logic: funds unlock automatically only on specific gate transitions (e.g., 50% on `G3_PASSED`, remainder on `G4_PASSED`) — never on manual admin override alone; log every release with the triggering gate event.

## 5. Workflow Logic & "The 4 Gates" — Including Definition of Done
You must enforce the Gated Governance model. A project entity in the database CANNOT change states unless specific conditions are met AND the acceptance evidence below is recorded:

*   **G1 (Actionability):** *Owned by District Innovation Cell.* Do not route raw citizen complaints to universities. An admin must set the state to `G1_PASSED`, which requires: evidence sufficiency confirmed (min. 1 media item or 2 corroborating reports) AND emergency-check field explicitly set to `false`. This triggers "Structured Demand Profile" generation.
*   **G2 (Capable Team):** *Owned by Lead HEI.* Routing must factor in a `Readiness_Score`. Do not assign projects to HEIs whose academic calendar indicates current exams. `G2_PASSED` requires: a named faculty mentor record, a minimum viable student team size, and an explicit accept action from the HEI account (not a default/auto-accept).
*   **G3 (Pilot Acceptance):** A project cannot move to deployment without digital sign-off from both the citizen and the local government tester. `G3_PASSED` requires: a citizen digital signature record, a government tester digital signature record, and at least one pilot evidence upload (photo/video/report).
*   **G4 (Ownership & Scale):** A project state cannot be `DEPLOYED` until a maintenance entity (e.g., Panchayat) is mapped to the database object. `G4_PASSED` requires: a maintenance-owner entity record (name, role, contact), an uploaded maintenance plan document, and a scheduled `6_month_check_in` job created in the task queue. The state only becomes `DEPLOYED_VERIFIED` after that check-in confirms continued use — `DEPLOYED` alone is not a terminal success state.

## 6. The "Emergency Bypass" Rule
*   If the AI Triage engine classifies an incoming problem as `URGENT/EMERGENCY` (e.g., medical crisis, broken pipe), you must instantly route it to the Government API endpoint and terminate the innovation workflow for that ticket. NEVER route an emergency to a student project queue.

## 7. Gamification & Incentive Logic
*   **Impact Points:** When designing the database schema, attach "Impact Points" heavily to the `G4_PASSED` and `DEPLOYED_VERIFIED` states, NOT to the `PROPOSAL_SUBMITTED` state. Reward actual deployment over mere ideation.
*   **Bounty System:** Automatically increment the `bounty_multiplier` field on a problem if it remains in the `UNASSIGNED` state for > 30 days.

## 8. Data Privacy & Localization (MeitY Compliance)
*   **PII Masking:** Never expose a citizen's Personal Identifiable Information (Phone number, exact home address) to the university or industry dashboards. Only expose the aggregated problem and the general Block/District location.
*   **No External LLM Data Leaks:** When utilizing external APIs to generate the "Gen-AI Starter Kit," do not pass citizen names or specific PII in the prompt payload. Strip it to the technical root cause only.
