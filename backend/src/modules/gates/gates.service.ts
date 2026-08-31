import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StateConflictError } from '../../shared/errors/domain.error';
import { AuthenticatedUser } from '../../shared/rbac/rbac.decorators';
import { PaginationQueryDto } from '../../shared/pagination/pagination.dto';
import { ProjectState, TERMINAL_PROJECT_STATES } from '../projects/project.entity';
import { Gate, GateOutcome, GateTransition } from './gate-transition.entity';

/**
 * Legal state edges (parameter.md §5).
 *
 * Declared as data so the gate engine is one table to read rather than four
 * bespoke implementations. `DEPLOYED` intentionally has an outgoing edge only to
 * `DEPLOYED_VERIFIED` — it is not a success state on its own.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<ProjectState, readonly ProjectState[]>> = {
  [ProjectState.G1_PASSED]: [ProjectState.G2_PASSED, ProjectState.ON_HOLD, ProjectState.CANCELLED],
  [ProjectState.G2_PASSED]: [ProjectState.G3_PASSED, ProjectState.ON_HOLD, ProjectState.CANCELLED],
  [ProjectState.G3_PASSED]: [ProjectState.G4_PASSED, ProjectState.ON_HOLD, ProjectState.CANCELLED],
  [ProjectState.G4_PASSED]: [ProjectState.DEPLOYED, ProjectState.ON_HOLD, ProjectState.CANCELLED],
  [ProjectState.DEPLOYED]: [ProjectState.DEPLOYED_VERIFIED, ProjectState.ON_HOLD],
  [ProjectState.DEPLOYED_VERIFIED]: [],
  [ProjectState.ON_HOLD]: [
    ProjectState.G2_PASSED,
    ProjectState.G3_PASSED,
    ProjectState.G4_PASSED,
    ProjectState.CANCELLED,
  ],
  [ProjectState.CANCELLED]: [],
};

export interface RecordTransitionInput {
  projectId: string;
  gate: Gate;
  outcome: GateOutcome;
  fromState: ProjectState | null;
  toState: ProjectState;
  actor: AuthenticatedUser;
  reason?: string | null;
  evidence?: Record<string, unknown> | null;
  requestId?: string | null;
}

@Injectable()
export class GatesService {
  constructor(
    @InjectRepository(GateTransition)
    private readonly transitions: Repository<GateTransition>,
  ) {}

  /**
   * Rejects an illegal edge before anything is written.
   *
   * A failed gate does not move the project forward, so only passes are checked
   * against the transition table.
   */
  assertTransitionLegal(from: ProjectState, to: ProjectState): void {
    if (TERMINAL_PROJECT_STATES.includes(from)) {
      throw new StateConflictError(`Project is in terminal state ${from} and cannot transition`, {
        from,
        to,
      });
    }

    if (!LEGAL_TRANSITIONS[from].includes(to)) {
      throw new StateConflictError(`Illegal gate transition ${from} -> ${to}`, {
        from,
        to,
        allowed: LEGAL_TRANSITIONS[from],
      });
    }
  }

  /**
   * Appends one immutable decision record. Called for passes and failures
   * alike — an attempt that was refused is exactly the history a governance
   * audit needs.
   */
  async record(input: RecordTransitionInput): Promise<GateTransition> {
    return this.transitions.save(
      this.transitions.create({
        projectId: input.projectId,
        gate: input.gate,
        outcome: input.outcome,
        fromState: input.fromState,
        toState: input.toState,
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        actorOrgUnitId: input.actor.orgUnitId,
        reason: input.reason ?? null,
        evidence: input.evidence ?? null,
        requestId: input.requestId ?? null,
      }),
    );
  }

  /** Full decision history for one project, oldest first. */
  historyFor(projectId: string, query: PaginationQueryDto): Promise<[GateTransition[], number]> {
    return this.transitions.findAndCount({
      where: { projectId },
      order: { createdAt: 'ASC' },
      skip: query.offset,
      take: query.limit,
    });
  }

  /** Which states a project may legally move to from where it is now. */
  allowedNextStates(from: ProjectState): readonly ProjectState[] {
    return LEGAL_TRANSITIONS[from];
  }
}
