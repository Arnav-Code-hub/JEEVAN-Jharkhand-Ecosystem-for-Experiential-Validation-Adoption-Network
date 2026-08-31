import { StateConflictError } from '../../shared/errors/domain.error';
import { ProjectState } from '../projects/project.entity';
import { GatesService, LEGAL_TRANSITIONS } from './gates.service';

describe('GatesService transition rules (parameter.md §5)', () => {
  const service = new GatesService({} as never);

  describe('legal progression', () => {
    it.each([
      [ProjectState.G1_PASSED, ProjectState.G2_PASSED],
      [ProjectState.G2_PASSED, ProjectState.G3_PASSED],
      [ProjectState.G3_PASSED, ProjectState.G4_PASSED],
      [ProjectState.G4_PASSED, ProjectState.DEPLOYED],
      [ProjectState.DEPLOYED, ProjectState.DEPLOYED_VERIFIED],
    ])('permits %s -> %s', (from, to) => {
      expect(() => service.assertTransitionLegal(from, to)).not.toThrow();
    });
  });

  describe('gate skipping is refused', () => {
    it.each([
      [ProjectState.G1_PASSED, ProjectState.G3_PASSED],
      [ProjectState.G1_PASSED, ProjectState.DEPLOYED],
      [ProjectState.G2_PASSED, ProjectState.G4_PASSED],
      [ProjectState.G1_PASSED, ProjectState.DEPLOYED_VERIFIED],
    ])('refuses %s -> %s', (from, to) => {
      expect(() => service.assertTransitionLegal(from, to)).toThrow(StateConflictError);
    });
  });

  describe('DEPLOYED is not a success state', () => {
    it('only permits DEPLOYED to advance to DEPLOYED_VERIFIED or ON_HOLD', () => {
      expect(LEGAL_TRANSITIONS[ProjectState.DEPLOYED]).toEqual([
        ProjectState.DEPLOYED_VERIFIED,
        ProjectState.ON_HOLD,
      ]);
    });

    it('cannot be cancelled after handover without going on hold first', () => {
      expect(() =>
        service.assertTransitionLegal(ProjectState.DEPLOYED, ProjectState.CANCELLED),
      ).toThrow(StateConflictError);
    });
  });

  describe('terminal states', () => {
    it.each([ProjectState.DEPLOYED_VERIFIED, ProjectState.CANCELLED])(
      '%s permits no further transition',
      (terminal) => {
        expect(LEGAL_TRANSITIONS[terminal]).toEqual([]);
        expect(() => service.assertTransitionLegal(terminal, ProjectState.G2_PASSED)).toThrow(
          StateConflictError,
        );
      },
    );

    it('reports terminal state in the error, not just a generic refusal', () => {
      expect(() =>
        service.assertTransitionLegal(ProjectState.DEPLOYED_VERIFIED, ProjectState.ON_HOLD),
      ).toThrow(/terminal state/);
    });
  });

  describe('recovery from a failed gate', () => {
    it('allows ON_HOLD to resume at any later gate', () => {
      expect(() =>
        service.assertTransitionLegal(ProjectState.ON_HOLD, ProjectState.G2_PASSED),
      ).not.toThrow();
      expect(() =>
        service.assertTransitionLegal(ProjectState.ON_HOLD, ProjectState.G4_PASSED),
      ).not.toThrow();
    });
  });

  it('exposes the allowed next states for a UI to render', () => {
    expect(service.allowedNextStates(ProjectState.G1_PASSED)).toContain(ProjectState.G2_PASSED);
    expect(service.allowedNextStates(ProjectState.DEPLOYED_VERIFIED)).toHaveLength(0);
  });

  it('declares an edge list for every state, so no state is unreachable by omission', () => {
    for (const state of Object.values(ProjectState)) {
      expect(LEGAL_TRANSITIONS[state]).toBeDefined();
    }
  });
});
