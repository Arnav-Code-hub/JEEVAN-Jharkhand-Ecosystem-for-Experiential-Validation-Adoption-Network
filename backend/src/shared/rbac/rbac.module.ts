import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { OrgScopeGuard, RolesGuard } from './guards';

/**
 * RBAC lives in `shared`, at the bottom of the dependency order, so any domain
 * module can guard a route without importing `auth` — which would invert the
 * dependency direction defined in parameter.md §1.
 */
@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, RolesGuard, OrgScopeGuard],
  exports: [PassportModule, RolesGuard, OrgScopeGuard],
})
export class RbacModule {}
