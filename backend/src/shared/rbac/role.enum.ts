/**
 * The six roles the platform recognises (parameter.md §2).
 *
 * Roles live here in `shared`, not in a role-named module — the backend module
 * axis is by domain, and roles are an authorisation concern used everywhere.
 */
export enum Role {
  CITIZEN = 'citizen',
  STUDENT = 'student',
  FACULTY = 'faculty',
  INDUSTRY = 'industry',
  /** District/block-scoped government reviewer. Owns G1 when configured to. */
  GOVT_OFFICER = 'govt_officer',
  /** State-level. The only role that reads across org units (ADR-0015). */
  GOVT_STATE_ADMIN = 'govt_state_admin',
}

/** Roles whose elevated access mandates TOTP 2FA (parameter.md §2). */
export const ROLES_REQUIRING_TOTP: readonly Role[] = [Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN];

/** Roles that must be attached to an org unit. */
export const ROLES_REQUIRING_ORG_UNIT: readonly Role[] = [
  Role.GOVT_OFFICER,
  Role.GOVT_STATE_ADMIN,
  Role.STUDENT,
  Role.FACULTY,
];

/** Roles that authenticate by phone rather than email. */
export const PHONE_ROLES: readonly Role[] = [Role.CITIZEN];

/** Roles exempt from org-unit scoping — they see every district (ADR-0015). */
export const UNSCOPED_ROLES: readonly Role[] = [Role.GOVT_STATE_ADMIN];

/** Roles that may never be created by self-registration. */
export const ADMIN_PROVISIONED_ROLES: readonly Role[] = [
  Role.GOVT_OFFICER,
  Role.GOVT_STATE_ADMIN,
  Role.FACULTY,
];
