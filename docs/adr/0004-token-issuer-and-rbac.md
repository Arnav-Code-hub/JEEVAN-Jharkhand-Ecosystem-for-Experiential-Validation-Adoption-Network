# ADR-0004: Who issues and verifies session tokens

- **Status:** **Accepted** — NestJS-issued JWTs; access + refresh, refresh in Redis
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted) (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 2 - auth, RBAC, every guard

## Context

The current implementation mints jeevan-citizen-token-<base64(phone)> and validates it by base64-decoding. There is no signature, no expiry, and no role claim, so it is trivially forgeable and gives the RBAC layer nothing to consume. parameter.md section 2 requires short-lived JWTs with role claims and no PII in the payload.

## Recommendation

NestJS issues and verifies its own signed JWTs via @nestjs/jwt and passport-jwt. Access tokens carry {sub, role, org_unit} and no PII; refresh tokens are stored server-side.

## Decision

**NestJS issues and verifies its own signed JWTs, using an access + refresh token pair
(Option B).**

- **Access token:** short-lived (default 15m), stateless, carrying `{ sub, role, orgUnitId }` and
  no PII, per `parameter.md` section 2.
- **Refresh token:** long-lived (default 30d), opaque, stored server-side in Redis and **rotated on
  every use**. Presenting an already-used refresh token is treated as theft and revokes the entire
  token family for that session.

Rationale given at decision time: revocability. Admin accounts hold PII access and gate-approval
authority, and their sessions must be terminable; a purely stateless JWT cannot be revoked before
it expires. Refresh tokens also spare citizens on poor rural connections from repeating OTP every
15 minutes.

Consequences now binding:
- Redis becomes a hard runtime dependency (it also holds OTP state).
- A `POST /auth/refresh` endpoint plus rotation and reuse-detection logic are required.
- Logout must revoke server-side, not merely discard the client's copy.

## Decision

**NestJS issues and verifies its own signed JWTs, using an access + refresh token pair
(Option B).**

- **Access token:** short-lived (default 15m), stateless, carrying `{ sub, role, orgUnitId }` and
  no PII, per `parameter.md` section 2.
- **Refresh token:** long-lived (default 30d), opaque, stored server-side in Redis and **rotated on
  every use**. Presenting an already-used refresh token is treated as theft and revokes the entire
  token family for that session.

Rationale given at decision time: revocability. Admin accounts hold PII access and gate-approval
authority, and their sessions must be terminable; a purely stateless JWT cannot be revoked before
it expires. Refresh tokens also spare citizens on poor rural connections from repeating OTP every
15 minutes.

Consequences now binding:
- Redis becomes a hard runtime dependency (it also holds OTP state).
- A `POST /auth/refresh` endpoint plus rotation and reuse-detection logic are required.
- Logout must revoke server-side, not merely discard the client's copy.

## Consequences if accepted

Enables RolesGuard and OrgScopeGuard, which every later module depends on. Requires a users table (Phase 2) and Redis for OTP state. Supersedes the current mock token entirely.

## Alternatives considered

Supabase Auth: awkward for the HEI domain allowlist, industry manual verification, and mandatory admin TOTP. Rejected alongside ADR-0001.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
