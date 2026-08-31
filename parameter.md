# AI Core Parameters & Guardrails
**Project:** Societal Innovation Collaboration Portal (Jharkhand)
**Objective:** Build a scalable, NEP-2020 aligned, closed-loop innovation ecosystem.

## 0. Build Sequencing (READ THIS FIRST)
Do not attempt to build all four gates and every stakeholder capability in a single pass. Build one working, testable slice at a time.

**The authoritative, phase-by-phase roadmap now lives in [`implementation_plan.md`](./implementation_plan.md).** That document supersedes the summary below and must be kept in sync with it. The ordering below is the feature-level intent; `implementation_plan.md` expresses it against the domain module axis defined in §1 and adds the cross-cutting foundation work that must precede it.

Feature-level order of delivery (each a vertical slice through the domain modules, not a role module):

0. **Foundation first.** Config, migrations, logging, error handling, and identity/RBAC are cross-cutting and must exist before any capability slice is called "done". A capability built before identity exists will be rebuilt.
1. **Citizen intake** — `issues` + `auth` + `users`: intake, geotagging, evidence/media, offline sync, status tracking, phone+OTP.
2. **Gate G1 + review** — `gates` + `projects`: District Innovation Cell review queue, Structured Demand Profile generation, emergency bypass rule.
3. **HEI routing + Gate G2** — `hei` + `competencies`: HEI onboarding, readiness-weighted routing, consortium formation, Gen-AI Starter Kit (mocked).
4. **Funding + Gates G3/G4** — `funding` + `notifications`: matchmaking, project charter, escrow (mocked), pilot sign-off, community handoff, ownership transfer.
5. **Predictive Engine, Gamification, Leaderboard, Credentials** — `reporting`: build last, only once the core pipeline above is functional end-to-end.

If a request asks for "the whole platform," build the foundation and slice 1 first, then confirm before proceeding.

## 1. Architectural Directives & Code Structure (STRICT MODULARITY)
*   **Tech Stack Strict Adherence:** You must exclusively use [Next.js/React] for the web portal, [Flutter] for the mobile app, [Node.js/NestJS] for the backend API, and [Python/FastAPI] for the AI/ML microservices.
*   **Domain-Driven Backend Modules (BACKEND AXIS — supersedes any earlier role-based backend mandate):** Do NOT hardcode the platform into a single monolithic codebase. The backend MUST be split by **domain (business concept)**, never by user role.

    A role-based backend split (`modules/citizen`, `modules/student`, `modules/government`, `modules/industry`) is explicitly **forbidden**, because the central entities are shared across every role: a `Project` is created by government at G1, accepted by an HEI at G2, funded by industry, signed off by a citizen at G3, and handed to a panchayat at G4. Under a role axis the gate engine has to live inside one role's module and be imported by the other three, which produces circular dependencies and shared ownership of the same service. Splitting by domain removes that class of problem entirely.

    Roles remain first-class — they are expressed in the **RBAC layer and the API surface**, not in the domain module tree.

*   **Separated UIs (FRONTEND AXIS — unchanged):** Each stakeholder must still have their own distinct, dedicated UI components, dashboards, and routing logic on the frontend, properly linked through a central Role-Based Access Control (RBAC) system. The role axis is correct for UI; it is only the backend domain-service axis that changes.
*   **Target Directory Structure:** Follow this shape (adapt file extensions to the framework in use, but preserve the module boundaries):

```
/backend
  /src
    /modules              # ONE MODULE PER DOMAIN (business concept) — never per role
      /auth               # OTP issuance/verification, sessions, JWT, guards
      /users              # user + org-unit records, HEI domain allowlist, verification state
      /issues             # citizen intake, evidence/media, corroboration, status tracking
      /projects           # structured demand profile -> project lifecycle, consortium assignment
      /gates              # generic gate engine (G1-G4): transitions, evidence rules, audit
      /funding            # escrow ledger, tranche release, PaymentGatewayClient
      /hei                # institutions, faculty, student teams, academic calendars, readiness
      /competencies       # competency taxonomy, demand/supply matching
      /notifications      # channel-agnostic outbound messaging
      /reporting          # dashboards, leaderboard, impact-point aggregation
      /intake-channels    # WhatsApp / voice webhook adapters that feed /issues
    /shared               # RBAC, audit logging, exception filters, interceptors, config
    /ai-gateway           # async client wrappers for all AI/ML calls (mocked in dev)
    /db                   # data source, migrations, seeds (PostgreSQL + pgvector)
/ml-service              # Python/FastAPI — triage, extraction, prediction (mocked responses in dev)
/web                     # Next.js — role-aware routing, one dashboard tree per role
/mobile                  # Flutter — citizen + student facing, offline-first
```

*   **Module Dependency Rule (enforces acyclicity):** Dependencies must flow in one direction only, from higher-level domains down to lower-level ones. A module may import from a module *below* it in this list, never from one above:

    ```
    reporting, intake-channels        (top — orchestration/read models)
    funding, competencies, notifications
    gates
    projects
    issues, hei
    auth
    users
    shared                            (bottom — depended on by all, depends on none)
    ```

    If two modules appear to need each other, that is a signal the shared concept belongs in a lower module, or the interaction belongs in an event rather than a direct import. Emit a domain event instead of adding an upward import. Never resolve a cycle with `forwardRef()`.
*   **Role expression:** Controllers may still be grouped by role for a clean API surface and RBAC clarity (e.g. a citizen-facing and an admin-facing controller over the same `issues` domain), but they must be thin and delegate to domain services. No business logic in a role-scoped controller.

*   **Database Constraints (amended 2026-08-31 — see [ADR-0002](./docs/adr/0002-neo4j-vs-pgvector.md)):** Use **PostgreSQL** as the single datastore — users, project states, gate records, escrow ledger entries, and the Competency Demand/Supply model. Competency matching uses the **`pgvector`** extension for embedding similarity rather than a graph database. **Neo4j is no longer part of this architecture** (it superseded an earlier mandate naming Neo4j as definitive); MongoDB is not used either. Do not introduce a second datastore for this responsibility.
*   **Offline-First & Accessibility:** The mobile frontend must support offline caching. UI must be designed assuming low-bandwidth environments, must support multi-language toggles (Hindi, English, Santali), and must meet WCAG 2.1 AA basics (screen-reader labels, sufficient contrast, keyboard/voice navigability) for the web portal.

## 2. Authentication & Identity
*   **Citizens:** Phone number + OTP only. No email/password flow — assume most users are on WhatsApp/mobile and have low tolerance for account creation friction. Allow anonymous draft submission that gets bound to a verified phone number before final submit.
*   **Students & Faculty:** Institutional email + OTP, verified against a whitelisted HEI domain list. That allowlist is owned by the `users` domain module and administered by government-role accounts.
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
