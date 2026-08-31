import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrgScopeGuard, RolesGuard, resolveScope } from '../../shared/rbac/guards';
import { AuthenticatedUser, CurrentUser } from '../../shared/rbac/rbac.decorators';
import { PaginatedResponse, PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { ProjectState } from './project.entity';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(RolesGuard, OrgScopeGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /**
   * Scope comes from the caller's token via `resolveScope`, never from a query
   * parameter — a district officer cannot widen their own visibility.
   */
  @Get()
  @ApiOperation({ summary: 'List projects visible to the caller' })
  @ApiQuery({ name: 'state', enum: ProjectState, required: false })
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('state') state?: ProjectState,
  ) {
    const [items, total] = await this.projects.findAllScoped(resolveScope(user), query, state);
    return PaginatedResponse.of(items, total, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findById(id);
  }

  @Get(':id/issues')
  @ApiOperation({ summary: 'Issues linked to this project, including merged ones' })
  linkedIssues(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.issuesFor(id);
  }
}
