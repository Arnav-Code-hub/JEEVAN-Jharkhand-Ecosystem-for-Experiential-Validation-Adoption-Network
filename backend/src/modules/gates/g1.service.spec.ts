import { BusinessRuleViolationError, StateConflictError } from '../../shared/errors/domain.error';
import { AuthenticatedUser } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { Issue, IssueStatus } from '../issues/issue.entity';
import { ProjectState } from '../projects/project.entity';
import { G1Service } from './g1.service';
import { GateOutcome } from './gate-transition.entity';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    title: 'Dry hand pump',
    description: 'No water for three weeks',
    status: IssueStatus.SUBMITTED,
    isEmergency: false,
    block: 'Kanke',
    ...overrides,
  } as Issue;
}

const officer: AuthenticatedUser = {
  userId: 'officer-1',
  role: Role.GOVT_OFFICER,
  orgUnitId: 'ranchi',
};

describe('G1Service', () => {
  let issues: {
    findOne: jest.Mock;
    setStatus: jest.Mock;
    countCorroborating: jest.Mock;
    countMedia: jest.Mock;
  };
  let projects: { createFromIssue: jest.Mock };
  let gates: { record: jest.Mock };
  let service: G1Service;

  beforeEach(() => {
    issues = {
      findOne: jest.fn(),
      setStatus: jest.fn().mockResolvedValue(undefined),
      countCorroborating: jest.fn().mockResolvedValue(1),
      countMedia: jest.fn().mockResolvedValue(0),
    };
    projects = {
      createFromIssue: jest
        .fn()
        .mockResolvedValue({ id: 'project-1', state: ProjectState.G1_PASSED }),
    };
    gates = { record: jest.fn().mockResolvedValue(undefined) };

    service = new G1Service(issues as never, projects as never, gates as never);
  });

  describe('evidence sufficiency (parameter.md §5)', () => {
    it('refuses a pass with no media and only one report', async () => {
      issues.findOne.mockResolvedValue(makeIssue());

      await expect(service.decide('issue-1', { pass: true }, officer)).rejects.toThrow(
        BusinessRuleViolationError,
      );
      expect(projects.createFromIssue).not.toHaveBeenCalled();
    });

    it('accepts a single media item', async () => {
      issues.findOne.mockResolvedValue(makeIssue());
      issues.countMedia.mockResolvedValue(1);

      const result = await service.decide('issue-1', { pass: true }, officer);

      expect(result.outcome).toBe(GateOutcome.PASSED);
      expect(result.evidence.satisfiedBy).toBe('media');
    });

    it('counts a voice note as a media item', async () => {
      issues.findOne.mockResolvedValue(makeIssue());
      issues.countMedia.mockResolvedValue(1);

      const result = await service.decide('issue-1', { pass: true }, officer);

      expect(result.evidence.mediaCount).toBe(1);
    });

    it('accepts two corroborating reports with no media', async () => {
      issues.findOne.mockResolvedValue(makeIssue());
      issues.countCorroborating.mockResolvedValue(2);

      const result = await service.decide('issue-1', { pass: true }, officer);

      expect(result.evidence.satisfiedBy).toBe('corroboration');
    });
  });

  describe('emergency bypass (parameter.md §6)', () => {
    it('refuses to route an emergency through G1', async () => {
      issues.findOne.mockResolvedValue(makeIssue({ isEmergency: true }));
      issues.countMedia.mockResolvedValue(1);

      await expect(service.decide('issue-1', { pass: true }, officer)).rejects.toThrow(
        /Emergencies must be routed/,
      );
      expect(projects.createFromIssue).not.toHaveBeenCalled();
    });
  });

  describe('passing', () => {
    beforeEach(() => {
      issues.findOne.mockResolvedValue(makeIssue());
      issues.countMedia.mockResolvedValue(1);
    });

    it('creates the demand profile and records the transition', async () => {
      const result = await service.decide('issue-1', { pass: true }, officer);

      expect(result.project?.id).toBe('project-1');
      expect(gates.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          outcome: GateOutcome.PASSED,
          fromState: null,
          toState: ProjectState.G1_PASSED,
          actor: officer,
        }),
      );
    });

    it('marks the issue verified', async () => {
      await service.decide('issue-1', { pass: true }, officer);

      expect(issues.setStatus).toHaveBeenCalledWith(
        'issue-1',
        IssueStatus.VERIFIED,
        officer.userId,
      );
    });
  });

  describe('failing', () => {
    beforeEach(() => issues.findOne.mockResolvedValue(makeIssue()));

    it('requires a reason', async () => {
      await expect(service.decide('issue-1', { pass: false }, officer)).rejects.toThrow(
        /reason is required/,
      );
    });

    it('rejects the issue and creates no project', async () => {
      const result = await service.decide('issue-1', { pass: false, reason: 'Duplicate' }, officer);

      expect(result.outcome).toBe(GateOutcome.FAILED);
      expect(result.project).toBeNull();
      expect(projects.createFromIssue).not.toHaveBeenCalled();
      expect(issues.setStatus).toHaveBeenCalledWith(
        'issue-1',
        IssueStatus.REJECTED,
        officer.userId,
        'Duplicate',
      );
    });
  });

  describe('idempotency', () => {
    it.each([IssueStatus.VERIFIED, IssueStatus.REJECTED, IssueStatus.RESOLVED])(
      'refuses to decide an issue already at %s',
      async (status) => {
        issues.findOne.mockResolvedValue(makeIssue({ status }));
        issues.countMedia.mockResolvedValue(1);

        await expect(service.decide('issue-1', { pass: true }, officer)).rejects.toThrow(
          StateConflictError,
        );
      },
    );
  });
});
