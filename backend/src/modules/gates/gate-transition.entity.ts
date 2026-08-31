import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../shared/rbac/role.enum';
import { ProjectState } from '../projects/project.entity';

export enum Gate {
  G1 = 'g1',
  G2 = 'g2',
  G3 = 'g3',
  G4 = 'g4',
  /** The six-month adoption check-in that promotes DEPLOYED to DEPLOYED_VERIFIED. */
  ADOPTION_CHECK_IN = 'adoption_check_in',
}

export enum GateOutcome {
  PASSED = 'passed',
  FAILED = 'failed',
}

/**
 * Append-only record of every gate decision.
 *
 * Never updated and never deleted: a gated governance model is only meaningful
 * if each decision is attributable and immutable. Failed attempts are recorded
 * alongside passes, so a project that was rejected twice before passing shows
 * that history.
 *
 * `evidence` holds references — media ids, signature record ids, document ids —
 * and must never contain citizen PII (parameter.md §8).
 */
@Entity('gate_transitions')
export class GateTransition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'enum', enum: Gate })
  gate!: Gate;

  @Column({ type: 'enum', enum: GateOutcome })
  outcome!: GateOutcome;

  /** Null for the transition that creates the project at G1. */
  @Column({ type: 'enum', enum: ProjectState, nullable: true })
  fromState!: ProjectState | null;

  @Column({ type: 'enum', enum: ProjectState })
  toState!: ProjectState;

  @Index()
  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'enum', enum: Role })
  actorRole!: Role;

  @Column({ type: 'uuid', nullable: true })
  actorOrgUnitId!: string | null;

  /** Why the gate failed, or a note on the pass. Never PII. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  /** References to the acceptance evidence required by parameter.md §5. */
  @Column({ type: 'jsonb', nullable: true })
  evidence!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
