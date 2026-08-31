import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ForbiddenActionError } from '../errors/domain.error';
import { AuthenticatedUser, PUBLIC_KEY, ROLES_KEY } from './rbac.decorators';
import { Role, UNSCOPED_ROLES } from './role.enum';

/**
 * Registered globally, so **every route requires a valid access token unless it
 * is explicitly marked `@Public()`**. Defaulting to closed means a forgotten
 * decorator produces a 401, not an open endpoint — which is exactly the failure
 * the pre-Phase-2 code had on its gate-review routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }
}

/** Enforces `@Roles(...)`. Runs after JwtAuthGuard, so `user` is populated. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) return false;

    if (!required.includes(user.role)) {
      throw new ForbiddenActionError('Your role may not perform this action.', {
        requiredRoles: required,
      });
    }

    return true;
  }
}

/**
 * Guarantees a scoped principal actually carries an org unit (ADR-0015).
 *
 * This is the cheap half of scoping. The expensive half — applying the scope
 * predicate to queries — belongs in each domain service, which is why
 * `resolveScope` below is exported for services to consume rather than being
 * hidden inside the guard.
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) return false;

    if (!UNSCOPED_ROLES.includes(user.role) && !user.orgUnitId) {
      throw new ForbiddenActionError('This account is not attached to an organisational unit.');
    }

    return true;
  }
}

export interface OrgScope {
  /** True when the principal reads across every org unit. */
  unrestricted: boolean;
  /** Root of the subtree the principal may read. Null only when unrestricted. */
  orgUnitId: string | null;
}

/**
 * Single place that decides what a principal may see. Domain services must call
 * this rather than reading `user.orgUnitId` directly, so the rule can change in
 * exactly one place.
 */
export function resolveScope(user: AuthenticatedUser): OrgScope {
  if (UNSCOPED_ROLES.includes(user.role)) {
    return { unrestricted: true, orgUnitId: null };
  }
  return { unrestricted: false, orgUnitId: user.orgUnitId };
}
