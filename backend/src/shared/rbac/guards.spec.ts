import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenActionError } from '../errors/domain.error';
import { OrgScopeGuard, RolesGuard, resolveScope } from './guards';
import { AuthenticatedUser } from './rbac.decorators';
import { Role } from './role.enum';

function contextFor(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function reflectorReturning(roles: Role[] | undefined): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

const citizen: AuthenticatedUser = { userId: 'u1', role: Role.CITIZEN, orgUnitId: null };
const officer: AuthenticatedUser = {
  userId: 'u2',
  role: Role.GOVT_OFFICER,
  orgUnitId: 'ranchi',
};
const stateAdmin: AuthenticatedUser = {
  userId: 'u3',
  role: Role.GOVT_STATE_ADMIN,
  orgUnitId: 'jh',
};

describe('RolesGuard', () => {
  it('allows a route with no @Roles metadata', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));

    expect(guard.canActivate(contextFor(citizen))).toBe(true);
  });

  it('allows a matching role', () => {
    const guard = new RolesGuard(reflectorReturning([Role.GOVT_OFFICER]));

    expect(guard.canActivate(contextFor(officer))).toBe(true);
  });

  it('rejects a non-matching role', () => {
    const guard = new RolesGuard(reflectorReturning([Role.GOVT_OFFICER]));

    expect(() => guard.canActivate(contextFor(citizen))).toThrow(ForbiddenActionError);
  });

  it('rejects a citizen from a gate-review route', () => {
    const guard = new RolesGuard(reflectorReturning([Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN]));

    expect(() => guard.canActivate(contextFor(citizen))).toThrow(ForbiddenActionError);
  });

  it('rejects when there is no authenticated principal', () => {
    const guard = new RolesGuard(reflectorReturning([Role.CITIZEN]));

    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });
});

describe('OrgScopeGuard', () => {
  const guard = new OrgScopeGuard();

  it('allows a scoped role that has an org unit', () => {
    expect(guard.canActivate(contextFor(officer))).toBe(true);
  });

  it('rejects a scoped role with no org unit', () => {
    const orphan: AuthenticatedUser = {
      userId: 'u4',
      role: Role.GOVT_OFFICER,
      orgUnitId: null,
    };

    expect(() => guard.canActivate(contextFor(orphan))).toThrow(ForbiddenActionError);
  });

  it('allows the unscoped state role regardless', () => {
    const admin: AuthenticatedUser = { ...stateAdmin, orgUnitId: null };

    expect(guard.canActivate(contextFor(admin))).toBe(true);
  });
});

describe('resolveScope', () => {
  it('restricts a district officer to their own org unit', () => {
    expect(resolveScope(officer)).toEqual({ unrestricted: false, orgUnitId: 'ranchi' });
  });

  it('gives the state admin unrestricted read (ADR-0015)', () => {
    expect(resolveScope(stateAdmin)).toEqual({ unrestricted: true, orgUnitId: null });
  });

  it('does not treat a citizen as unrestricted', () => {
    expect(resolveScope(citizen).unrestricted).toBe(false);
  });
});
