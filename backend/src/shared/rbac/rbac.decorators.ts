import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from './role.enum';

export const ROLES_KEY = 'rbac:roles';
export const PUBLIC_KEY = 'rbac:public';

/**
 * Restricts a route to the listed roles. Without it, an authenticated user of
 * any role may call the route — so state the roles explicitly on anything
 * privileged.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Opts a route out of authentication. Authentication is on by default via the
 * global JwtAuthGuard, so forgetting a decorator fails closed rather than open.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** The identity carried by a validated access token. Contains no PII (§2). */
export interface AuthenticatedUser {
  userId: string;
  role: Role;
  orgUnitId: string | null;
}

/** Injects the authenticated principal, or a single property of it. */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return property ? user[property] : user;
  },
);
