import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../rbac/rbac.decorators';

/**
 * Deliberately unversioned, outside the /api prefix, and public, so the
 * deployment's health probe never has to change when the API version does
 * (ADR-0016) and never needs a credential. Authentication is global from
 * Phase 2 onward, so the opt-out has to be explicit.
 */
@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness and dependency readiness probe' })
  check() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 1500 })]);
  }
}
