import { Injectable } from '@nestjs/common';
import { BusinessRuleViolationError, StateConflictError } from '../../shared/errors/domain.error';
import { AuthenticatedUser } from '../../shared/rbac/rbac.decorators';
import { Issue, IssueStatus } from '../issues/issue.entity';
import { IssuesService } from '../issues/issues.service';
import { Project, ProjectState } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Gate, GateOutcome } from './gate-transition.entity';
import { GatesService } from './gates.service';
import { G1DecisionDto } from './gates.dto';

export interface G1Result {
  outcome: GateOutcome;
  issueStatus: IssueStatus;
  project: Project | null;
  /** Which acceptance conditions were satisfied — recorded as gate evidence. */
  evidence: Record<string, unknown>;
}

/** parameter.md §5: at least one media item, or two corroborating reports. */
const MIN_MEDIA_ITEMS = 1;
const MIN_CORROBORATING_REPORTS = 2;

@Injectable()
export class G1Service {
  constructor(
    private readonly issues: IssuesService,
    private readonly projects: ProjectsService,
    private readonly gates: GatesService,
  ) {}

  /**
   * Records the District Innovation Cell's actionability decision.
   *
   * Passing requires the acceptance evidence in parameter.md §5 — this is the
   * check the pre-Phase-3 `review()` did not perform at all, which meant any
   * complaint could be promoted with no evidence whatsoever.
   */
  async decide(issueId: string, dto: G1DecisionDto, actor: AuthenticatedUser): Promise<G1Result> {
    const issue = await this.issues.findOne(issueId);

    if (issue.status !== IssueStatus.SUBMITTED && issue.status !== IssueStatus.UNDER_REVIEW) {
      throw new StateConflictError(`Issue has already been decided (status ${issue.status})`, {
        status: issue.status,
      });
    }

    if (!dto.pass) {
      return this.fail(issue, dto, actor);
    }

    const evidence = await this.assertEvidenceSufficient(issue);

    const project = await this.projects.createFromIssue({
      title: issue.title,
      problemStatement: issue.description,
      originIssueId: issue.id,
      orgUnitId: dto.orgUnitId ?? null,
    });

    await this.issues.setStatus(issue.id, IssueStatus.VERIFIED, actor.userId);

    await this.gates.record({
      projectId: project.id,
      gate: Gate.G1,
      outcome: GateOutcome.PASSED,
      // No prior state: G1 is what brings the project into existence.
      fromState: null,
      toState: ProjectState.G1_PASSED,
      actor,
      reason: dto.reason ?? null,
      evidence,
    });

    return {
      outcome: GateOutcome.PASSED,
      issueStatus: IssueStatus.VERIFIED,
      project,
      evidence,
    };
  }

  /**
   * §5: evidence sufficiency is (>= 1 media item) OR (>= 2 corroborating
   * reports), AND the emergency flag must be explicitly false — an emergency
   * belongs with a government repair team, never in a student project queue
   * (§6).
   */
  private async assertEvidenceSufficient(issue: Issue): Promise<Record<string, unknown>> {
    if (issue.isEmergency) {
      throw new BusinessRuleViolationError(
        'Emergencies must be routed to the responsible department, not through G1.',
        { isEmergency: true },
      );
    }

    const mediaCount = await this.issues.countMedia(issue.id);
    const corroboratingCount = await this.issues.countCorroborating(issue);

    const hasMedia = mediaCount >= MIN_MEDIA_ITEMS;
    const hasCorroboration = corroboratingCount >= MIN_CORROBORATING_REPORTS;

    if (!hasMedia && !hasCorroboration) {
      throw new BusinessRuleViolationError(
        'G1 requires at least one media item or two corroborating reports.',
        { mediaCount, corroboratingCount },
      );
    }

    return {
      mediaCount,
      corroboratingCount,
      satisfiedBy: hasMedia ? 'media' : 'corroboration',
      emergencyChecked: true,
    };
  }

  private async fail(
    issue: Issue,
    dto: G1DecisionDto,
    actor: AuthenticatedUser,
  ): Promise<G1Result> {
    if (!dto.reason) {
      throw new BusinessRuleViolationError('A reason is required when failing a gate.');
    }

    await this.issues.setStatus(issue.id, IssueStatus.REJECTED, actor.userId, dto.reason);

    // A failed G1 creates no project, so there is no project row to attach the
    // transition to. The refusal is captured in the audit log by the
    // controller's @Audit decorator instead.
    return {
      outcome: GateOutcome.FAILED,
      issueStatus: IssueStatus.REJECTED,
      project: null,
      evidence: { reason: dto.reason },
    };
  }
}
