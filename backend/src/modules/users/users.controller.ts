import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../shared/audit/audit.interceptor';
import { OrgScopeGuard, RolesGuard } from '../../shared/rbac/guards';
import { Roles } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { HeiDomainsService } from './hei-domains.service';
import { OrgUnitsService } from './org-units.service';
import { OrgUnitTier } from './entities/org-unit.entity';
import { UsersService } from './users.service';
import { CreateHeiDomainDto, SetActiveDto } from './users.dto';

/**
 * Administration of identity master data. Thin role-scoped controller over the
 * `users` domain — no business logic here, per parameter.md §1.
 */
@ApiTags('Administration')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
export class UsersAdminController {
  constructor(
    private readonly users: UsersService,
    private readonly heiDomains: HeiDomainsService,
  ) {}

  @Get('hei-domains')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'List the institutional email allowlist' })
  listHeiDomains() {
    return this.heiDomains.findAll();
  }

  @Post('hei-domains')
  @Roles(Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Add an institution to the email allowlist' })
  @Audit({
    action: 'users.hei_domain.create',
    resourceType: 'hei_domain',
    fromResult: (r) => {
      const d = r as { id: string; domain: string };
      return { resourceId: d.id, metadata: { domain: d.domain } };
    },
  })
  createHeiDomain(@Body() dto: CreateHeiDomainDto) {
    return this.heiDomains.create(dto);
  }

  @Patch('hei-domains/:id')
  @Roles(Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Enable or disable an allowlisted institution' })
  @Audit({
    action: 'users.hei_domain.set_active',
    resourceType: 'hei_domain',
    resourceIdParam: 'id',
  })
  setHeiDomainActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto) {
    return this.heiDomains.setActive(id, dto.isActive);
  }

  @Get('users/pending')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Industry accounts awaiting manual verification' })
  listPending() {
    return this.users.findPendingVerification();
  }

  @Post('users/:id/activate')
  @Roles(Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Verify and activate a pending account' })
  @Audit({ action: 'users.account.activate', resourceType: 'user', resourceIdParam: 'id' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.activate(id);
    return { id: user.id, role: user.role, status: user.status };
  }

  @Post('users/:id/suspend')
  @Roles(Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Suspend an account' })
  @Audit({ action: 'users.account.suspend', resourceType: 'user', resourceIdParam: 'id' })
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.suspend(id);
    return { id: user.id, role: user.role, status: user.status };
  }
}

@ApiTags('Organisation')
@ApiBearerAuth()
@Controller('org-units')
@UseGuards(RolesGuard, OrgScopeGuard)
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get('districts')
  @ApiOperation({ summary: 'List Jharkhand districts' })
  listDistricts() {
    return this.orgUnits.findByTier(OrgUnitTier.DISTRICT);
  }

  @Get(':id/children')
  @ApiOperation({ summary: 'List the direct children of an org unit' })
  listChildren(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgUnits.findChildren(id);
  }
}
