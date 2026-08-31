import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../shared/audit/audit.interceptor';
import { OrgScopeGuard, RolesGuard } from '../../shared/rbac/guards';
import { AuthenticatedUser, CurrentUser, Roles } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { PaginatedResponse, PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { G1DecisionDto } from './gates.dto';
import { GatesService } from './gates.service';
import { G1Service } from './g1.service';

/**
 * Gate decisions live here rather than on the issue or project controllers.
 *
 * A gate decision touches both aggregates — it moves the issue's status and
 * creates or advances a project — so it belongs in the module that sits above
 * both in the dependency order (parameter.md §1). Putting it on `issues` would
 * have forced an upward import of `projects`.
 */
@ApiTags('Gates')
@ApiBearerAuth()
@Controller('gates')
@UseGuards(RolesGuard, OrgScopeGuard)
export class GatesController {
  constructor(
    private readonly g1: G1Service,
    private readonly gates: GatesService,
  ) {}

  @Post('g1/:issueId/decision')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({
    summary: 'G1 Actionability decision — pass creates the Structured Demand Profile',
  })
  @Audit({
    action: 'gates.g1.decision',
    resourceType: 'issue',
    resourceIdParam: 'issueId',
    fromResult: (r) => {
      const d = r as { outcome: string; project?: { id: string; state: string } };
      return { metadata: { outcome: d.outcome, projectState: d.project?.state ?? null } };
    },
  })
  decideG1(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: G1DecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.g1.decide(issueId, dto, actor);
  }

  @Get('projects/:projectId/history')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Immutable gate decision history for a project' })
  async history(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const [items, total] = await this.gates.historyFor(projectId, query);
    return PaginatedResponse.of(items, total, query);
  }
}
