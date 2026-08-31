import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ResourceNotFoundError } from '../../shared/errors/domain.error';
import { PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { MediaService } from '../media/media.service';
import { Issue, IssueStatus } from './issue.entity';
import { CreateIssueDto, UpdateIssueDto } from './issues.dto';

export interface CreateIssueResult {
  issue: Issue;
  /** False when an existing record was returned for a repeated clientId. */
  created: boolean;
}

@Injectable()
export class IssuesService {
  private readonly corroborationRadiusMetres: number;
  private readonly corroborationWindowDays: number;

  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    private readonly media: MediaService,
    config: ConfigService,
  ) {
    this.corroborationRadiusMetres = config.getOrThrow<number>('CORROBORATION_RADIUS_METRES');
    this.corroborationWindowDays = config.getOrThrow<number>('CORROBORATION_WINDOW_DAYS');
  }

  /**
   * Idempotent on `clientId` (ADR-0005 companion work).
   *
   * A retried offline submission returns the original record rather than
   * creating a duplicate. The unique index is the real guarantee; the lookup
   * below is the fast path, and the catch handles the race where two retries
   * arrive together.
   */
  async create(dto: CreateIssueDto, reporterUserId: string): Promise<CreateIssueResult> {
    const { mediaIds, clientId, ...fields } = dto;

    if (clientId) {
      const existing = await this.issueRepo.findOneBy({ clientId });
      if (existing) return { issue: existing, created: false };
    }

    let issue: Issue;
    try {
      issue = await this.issueRepo.save(
        this.issueRepo.create({
          ...fields,
          clientId: clientId ?? null,
          reportedByUserId: reporterUserId,
        }),
      );
    } catch (error) {
      // Unique violation on clientId: another retry won the race.
      if (clientId && (error as { code?: string }).code === '23505') {
        const existing = await this.issueRepo.findOneBy({ clientId });
        if (existing) return { issue: existing, created: false };
      }
      throw error;
    }

    if (mediaIds?.length) {
      await this.media.attachToIssue(mediaIds, issue.id, reporterUserId);
    }

    return { issue, created: true };
  }

  /** Paginated. Unbounded listing was removed in Phase 3. */
  async findAll(query: PaginationQueryDto, status?: IssueStatus): Promise<[Issue[], number]> {
    return this.issueRepo.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: query.offset,
      take: query.limit,
    });
  }

  async findOne(id: string): Promise<Issue> {
    const issue = await this.issueRepo.findOneBy({ id });
    if (!issue) throw new ResourceNotFoundError(`Issue ${id} not found`);
    return issue;
  }

  async update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    const issue = await this.findOne(id);
    // mediaIds and clientId are creation-time only: attachments are managed via
    // the media endpoints, and an idempotency key must never be reassigned.
    const fields = { ...dto };
    delete fields.mediaIds;
    delete fields.clientId;
    Object.assign(issue, fields);
    return this.issueRepo.save(issue);
  }

  /**
   * Applies a status decided by the gates module. Kept deliberately dumb: the
   * G1 acceptance rules live in `gates`, which sits above this module.
   */
  async setStatus(
    id: string,
    status: IssueStatus,
    reviewerUserId: string,
    rejectionReason?: string,
  ): Promise<Issue> {
    const issue = await this.findOne(id);
    issue.status = status;
    issue.reviewedBy = reviewerUserId;
    issue.reviewedAt = new Date();
    if (status === IssueStatus.REJECTED) {
      issue.rejectionReason = rejectionReason ?? null;
    }
    return this.issueRepo.save(issue);
  }

  /** Confirmed evidence files attached to an issue, for the G1 evidence rule. */
  countMedia(issueId: string): Promise<number> {
    return this.media.countConfirmedForIssue(issueId);
  }

  /**
   * Independent reports describing the same problem (ADR-0006).
   *
   * Same category, within a configured radius, within a configured time window.
   * Falls back to same-block matching when a report carries no coordinates —
   * a WhatsApp or voice submission often will not.
   *
   * Haversine in SQL rather than PostGIS: the extension is not needed for a
   * single-radius filter at this data volume, and adding it is a migration we
   * can make later if the predictive work in Phase 8 wants real geometry.
   */
  async countCorroborating(issue: Issue): Promise<number> {
    const since = new Date(Date.now() - this.corroborationWindowDays * 86_400_000);

    const lat = issue.latitude === null ? null : Number(issue.latitude);
    const lng = issue.longitude === null ? null : Number(issue.longitude);

    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      if (!issue.block) return 1;

      return this.issueRepo.count({
        where: {
          category: issue.category,
          block: issue.block,
          status: Not(IssueStatus.REJECTED),
        },
      });
    }

    const row = await this.issueRepo
      .createQueryBuilder('i')
      .select('COUNT(*)', 'count')
      .where('i.category = :category', { category: issue.category })
      .andWhere('i.status != :rejected', { rejected: IssueStatus.REJECTED })
      .andWhere('i.createdAt >= :since', { since })
      .andWhere('i.latitude IS NOT NULL AND i.longitude IS NOT NULL')
      .andWhere(
        `6371000 * acos(LEAST(1, GREATEST(-1,
           cos(radians(:lat)) * cos(radians(i.latitude))
           * cos(radians(i.longitude) - radians(:lng))
           + sin(radians(:lat)) * sin(radians(i.latitude))
         ))) <= :radius`,
        { lat, lng, radius: this.corroborationRadiusMetres },
      )
      .getRawOne<{ count: string }>();

    return Number(row?.count ?? 0);
  }

  /** G1 review queue: submitted issues awaiting first review, paginated. */
  async getReviewQueue(query: PaginationQueryDto): Promise<[Issue[], number]> {
    return this.issueRepo.findAndCount({
      where: { status: IssueStatus.SUBMITTED },
      order: { isEmergency: 'DESC', createdAt: 'ASC' },
      skip: query.offset,
      take: query.limit,
    });
  }
}
