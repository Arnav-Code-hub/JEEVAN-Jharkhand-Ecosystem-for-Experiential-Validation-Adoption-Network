import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../shared/audit/audit.interceptor';
import { RolesGuard } from '../../shared/rbac/guards';
import { AuthenticatedUser, CurrentUser, Roles } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { PaginatedResponse, PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { DomainError } from '../../shared/errors/domain.error';
import { MediaService } from '../media/media.service';
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto } from './issues.dto';
import { SyncIssuesDto, SyncItemResult } from './sync.dto';
import { IssueStatus } from './issue.entity';
import { toIssueView, toIssueViews } from './issue.view';

/**
 * Every read path returns an `IssueView`, never the raw entity — that mapper is
 * the single place where the parameter.md §8 masking rule is applied.
 *
 * The G1 review endpoint that used to live here has moved to the `gates` module:
 * a gate decision spans the issue and project aggregates, so it belongs above
 * both in the dependency order.
 */
@ApiTags('Issues')
@ApiBearerAuth()
@Controller('issues')
@UseGuards(RolesGuard)
export class IssuesController {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly media: MediaService,
  ) {}

  @Post()
  @Roles(Role.CITIZEN)
  @ApiOperation({ summary: 'Submit an issue. Idempotent when a clientId is supplied.' })
  @Audit({
    action: 'issues.create',
    resourceType: 'issue',
    fromResult: (r) => ({ resourceId: (r as { id: string }).id }),
  })
  async create(@Body() dto: CreateIssueDto, @CurrentUser() user: AuthenticatedUser) {
    const { issue } = await this.issuesService.create(dto, user.userId);
    return toIssueView(issue, user, await this.media.findForIssue(issue.id));
  }

  /**
   * Batch endpoint for offline-first clients.
   *
   * Each item succeeds or fails independently: one malformed submission in a
   * queue of fifty must not block the other forty-nine, which is exactly the
   * situation a rural client coming back online is in.
   */
  @Post('sync')
  @Roles(Role.CITIZEN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a batch of offline submissions' })
  @Audit({ action: 'issues.sync' })
  async sync(
    @Body() dto: SyncIssuesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ results: SyncItemResult[] }> {
    const results: SyncItemResult[] = [];

    for (const item of dto.issues) {
      try {
        const { issue, created } = await this.issuesService.create(item, user.userId);
        results.push({
          clientId: item.clientId ?? null,
          outcome: created ? 'created' : 'duplicate',
          issueId: issue.id,
        });
      } catch (error) {
        results.push({
          clientId: item.clientId ?? null,
          outcome: 'failed',
          error: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        });
      }
    }

    return { results };
  }

  @Get()
  @ApiOperation({ summary: 'List issues (paginated, PII masked by role)' })
  @ApiQuery({ name: 'status', enum: IssueStatus, required: false })
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: IssueStatus,
  ) {
    const [items, total] = await this.issuesService.findAll(query, status);
    const media = await this.media.findForIssues(items.map((i) => i.id));
    return PaginatedResponse.of(toIssueViews(items, user, media), total, query);
  }

  @Get('review-queue')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'G1 queue: issues awaiting a decision (paginated)' })
  async getReviewQueue(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const [items, total] = await this.issuesService.getReviewQueue(query);
    const media = await this.media.findForIssues(items.map((i) => i.id));
    return PaginatedResponse.of(toIssueViews(items, user, media), total, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single issue (PII masked by role)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const issue = await this.issuesService.findOne(id);
    return toIssueView(issue, user, await this.media.findForIssue(id));
  }

  @Patch(':id')
  @Roles(Role.GOVT_OFFICER, Role.GOVT_STATE_ADMIN)
  @ApiOperation({ summary: 'Update an issue' })
  @Audit({ action: 'issues.update', resourceType: 'issue', resourceIdParam: 'id' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const issue = await this.issuesService.update(id, dto);
    return toIssueView(issue, user, await this.media.findForIssue(id));
  }
}
