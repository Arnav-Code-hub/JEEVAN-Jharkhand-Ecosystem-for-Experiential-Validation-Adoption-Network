import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ResourceNotFoundError, StateConflictError } from '../../shared/errors/domain.error';
import { OrgScope } from '../../shared/rbac/guards';
import { PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { OrgUnit } from '../users/entities/org-unit.entity';
import { Project, ProjectIssue, ProjectState } from './project.entity';

export interface CreateProjectInput {
  title: string;
  problemStatement: string;
  originIssueId: string;
  orgUnitId: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectIssue) private readonly links: Repository<ProjectIssue>,
    @InjectRepository(OrgUnit) private readonly orgUnits: Repository<OrgUnit>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates the Structured Demand Profile for an issue that has passed G1.
   *
   * The project and its first issue link are written in one transaction: a
   * project with no originating issue would be unattributable, which the
   * governance model cannot tolerate.
   */
  async createFromIssue(input: CreateProjectInput): Promise<Project> {
    const existing = await this.links.findOneBy({ issueId: input.originIssueId, isPrimary: true });
    if (existing) {
      throw new StateConflictError('A project already exists for this issue', {
        projectId: existing.projectId,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const reference = await this.nextReference(manager.getRepository(Project));

      const project = await manager.getRepository(Project).save(
        manager.getRepository(Project).create({
          reference,
          title: input.title,
          problemStatement: input.problemStatement,
          originIssueId: input.originIssueId,
          orgUnitId: input.orgUnitId,
          state: ProjectState.G1_PASSED,
        }),
      );

      await manager.getRepository(ProjectIssue).save(
        manager.getRepository(ProjectIssue).create({
          projectId: project.id,
          issueId: input.originIssueId,
          isPrimary: true,
        }),
      );

      return project;
    });
  }

  /** Attaches a corroborating issue to an existing project (the G1 merge branch). */
  async mergeIssue(projectId: string, issueId: string): Promise<ProjectIssue> {
    await this.findById(projectId);

    const existing = await this.links.findOneBy({ projectId, issueId });
    if (existing) throw new StateConflictError('Issue is already linked to this project');

    return this.links.save(this.links.create({ projectId, issueId, isPrimary: false }));
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projects.findOneBy({ id });
    if (!project) throw new ResourceNotFoundError(`Project ${id} not found`);
    return project;
  }

  /**
   * Applies the caller's org scope (ADR-0015) and paginates.
   *
   * Scope is resolved from the JWT by `resolveScope`, never from a query
   * parameter, so a district officer cannot widen their own visibility.
   */
  async findAllScoped(
    scope: OrgScope,
    query: PaginationQueryDto,
    state?: ProjectState,
  ): Promise<[Project[], number]> {
    const qb = this.projects.createQueryBuilder('p').orderBy('p.createdAt', 'DESC');

    if (state) qb.andWhere('p.state = :state', { state });

    if (!scope.unrestricted) {
      const ids = await this.scopeOrgUnitIds(scope.orgUnitId);
      // An empty scope must match nothing, not everything.
      if (ids.length === 0) return [[], 0];
      qb.andWhere('p.orgUnitId IN (:...ids)', { ids });
    }

    return qb.skip(query.offset).take(query.limit).getManyAndCount();
  }

  async issuesFor(projectId: string): Promise<ProjectIssue[]> {
    return this.links.find({ where: { projectId }, order: { createdAt: 'ASC' } });
  }

  /** Persists a state change. Legality is enforced by the gates module. */
  async applyState(projectId: string, state: ProjectState): Promise<Project> {
    const project = await this.findById(projectId);
    project.state = state;
    return this.projects.save(project);
  }

  /** Every org unit at or beneath the caller's, via the materialised path. */
  private async scopeOrgUnitIds(orgUnitId: string | null): Promise<string[]> {
    if (!orgUnitId) return [];

    const root = await this.orgUnits.findOneBy({ id: orgUnitId });
    if (!root) return [];

    const rows = await this.orgUnits
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('u.path = :path OR u.path LIKE :prefix', {
        path: root.path,
        prefix: `${root.path}/%`,
      })
      .getRawMany<{ id: string }>();

    return rows.map((r) => r.id);
  }

  private async nextReference(repo: Repository<Project>): Promise<string> {
    const count = await repo.count();
    return `JH-${String(count + 1).padStart(6, '0')}`;
  }

  /** Used by reporting to resolve a batch of projects without N+1 queries. */
  findByIds(ids: string[]): Promise<Project[]> {
    return ids.length ? this.projects.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }
}
