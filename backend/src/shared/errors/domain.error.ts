/**
 * Domain error taxonomy.
 *
 * Domain services throw these instead of HTTP exceptions, so business rules stay
 * transport-agnostic — the same rule can be enforced from a controller, a queue
 * worker, or a scheduled job. `AllExceptionsFilter` maps them to HTTP.
 *
 * `code` is a stable, machine-readable string. Clients should branch on it rather
 * than on the human-readable message, which may be reworded or localised.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  /** Extra machine-readable context. Must never contain PII (parameter.md §8). */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** A requested entity does not exist, or is not visible to the caller. */
export class ResourceNotFoundError extends DomainError {
  readonly code = 'RESOURCE_NOT_FOUND';
}

/** The request is well-formed but violates a business rule. */
export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
}

/** The action conflicts with current state (e.g. an illegal gate transition). */
export class StateConflictError extends DomainError {
  readonly code = 'STATE_CONFLICT';
}

/** The caller is authenticated but not permitted to perform this action. */
export class ForbiddenActionError extends DomainError {
  readonly code = 'FORBIDDEN_ACTION';
}

/** A downstream dependency (ML service, payment gateway, storage) failed. */
export class UpstreamServiceError extends DomainError {
  readonly code = 'UPSTREAM_SERVICE_ERROR';
}
