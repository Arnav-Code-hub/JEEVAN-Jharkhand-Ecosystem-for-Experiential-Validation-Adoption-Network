import { AuthenticatedUser } from '../../shared/rbac/rbac.decorators';
import { Role } from '../../shared/rbac/role.enum';
import { IntakeChannel, Issue, IssueCategory, IssueStatus } from './issue.entity';
import { toIssueView } from './issue.view';

const OWNER_ID = 'citizen-owner';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    title: 'Broken hand pump',
    description: 'The village hand pump has been dry for three weeks',
    category: IssueCategory.WATER,
    status: IssueStatus.SUBMITTED,
    channel: IntakeChannel.MOBILE,
    // TypeORM returns decimals as strings; the mapper must cope.
    latitude: '23.3441789' as unknown as number,
    longitude: '85.3096123' as unknown as number,
    address: 'House 14, Ward 3, Kanke Road',
    district: 'Ranchi',
    block: 'Kanke',
    reportedByUserId: OWNER_ID,
    citizenName: 'Rajesh Kumar',
    citizenPhone: '+919876543210',
    citizenEmail: 'rajesh@example.com',
    imageUrls: ['https://storage/1.jpg'],
    voiceNoteUrl: null,
    urgencyScore: null,
    isEmergency: false,
    aiSummary: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  } as Issue;
}

const viewer = (role: Role, userId = 'someone-else'): AuthenticatedUser => ({
  userId,
  role,
  orgUnitId: role === Role.GOVT_OFFICER ? 'ranchi' : null,
});

const PII_STRINGS = ['Rajesh Kumar', '+919876543210', 'rajesh@example.com', 'House 14'];

describe('toIssueView — parameter.md §8 masking', () => {
  describe.each([
    ['student', Role.STUDENT],
    ['faculty', Role.FACULTY],
    ['industry', Role.INDUSTRY],
  ])('%s must never see citizen PII', (_label, role) => {
    const view = toIssueView(makeIssue(), viewer(role));
    const serialised = JSON.stringify(view);

    it('omits name, phone, email and street address', () => {
      expect(view.citizenName).toBeUndefined();
      expect(view.citizenPhone).toBeUndefined();
      expect(view.citizenEmail).toBeUndefined();
      expect(view.address).toBeUndefined();
    });

    it.each(PII_STRINGS)('does not leak %s anywhere in the payload', (needle) => {
      expect(serialised).not.toContain(needle);
    });

    it('coarsens coordinates to roughly one kilometre', () => {
      expect(view.latitude).toBe(23.34);
      expect(view.longitude).toBe(85.31);
    });

    it('still exposes district and block, which §8 permits', () => {
      expect(view.district).toBe('Ranchi');
      expect(view.block).toBe('Kanke');
    });

    it('reports that PII was withheld', () => {
      expect(view.piiVisible).toBe(false);
    });
  });

  describe.each([
    ['district officer', Role.GOVT_OFFICER],
    ['state admin', Role.GOVT_STATE_ADMIN],
  ])('%s may see contact details', (_label, role) => {
    const view = toIssueView(makeIssue(), viewer(role));

    it('includes contact details needed to verify and to run the G3 pilot', () => {
      expect(view.citizenPhone).toBe('+919876543210');
      expect(view.address).toBe('House 14, Ward 3, Kanke Road');
    });

    it('keeps full coordinate precision', () => {
      expect(view.latitude).toBeCloseTo(23.3441789, 6);
    });

    it('reports that PII was shown', () => {
      expect(view.piiVisible).toBe(true);
    });
  });

  describe('citizens', () => {
    it('sees their own submission in full', () => {
      const view = toIssueView(makeIssue(), viewer(Role.CITIZEN, OWNER_ID));

      expect(view.citizenPhone).toBe('+919876543210');
      expect(view.piiVisible).toBe(true);
    });

    it('does not see another citizen PII', () => {
      const view = toIssueView(makeIssue(), viewer(Role.CITIZEN, 'a-different-citizen'));

      expect(view.citizenPhone).toBeUndefined();
      expect(view.latitude).toBe(23.34);
    });

    it('cannot claim ownership of an anonymous issue by having a null user id', () => {
      const anonymous = makeIssue({ reportedByUserId: null });
      const view = toIssueView(anonymous, {
        userId: null as unknown as string,
        role: Role.CITIZEN,
        orgUnitId: null,
      });

      expect(view.piiVisible).toBe(false);
      expect(view.citizenPhone).toBeUndefined();
    });
  });

  describe('coordinate handling', () => {
    it('passes through nulls', () => {
      const view = toIssueView(
        makeIssue({ latitude: null, longitude: null }),
        viewer(Role.STUDENT),
      );

      expect(view.latitude).toBeNull();
      expect(view.longitude).toBeNull();
    });

    it('normalises string decimals to numbers even when unmasked', () => {
      const view = toIssueView(makeIssue(), viewer(Role.GOVT_OFFICER));

      expect(typeof view.latitude).toBe('number');
    });
  });
});
