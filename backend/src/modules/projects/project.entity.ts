import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OrgUnit } from '../users/entities/org-unit.entity';
import { Issue } from '../issues/issue.entity';

/**
 * The documented state vocabulary (parameter.md §5).
 *
 * `DEPLOYED` is deliberately **not** terminal: only `DEPLOYED_VERIFIED`, reached
 * after the six-month adoption check-in confirms continued use, counts as
 * success. That distinction is the project's central idea and every report and
 * leaderboard must respect it.
 */
export enum ProjectState {
  /** Structured Demand Profile created when the originating issue passes G1. */
  G1_PASSED = 'g1_passed',
  /** A capable HEI consortium has explicitly accepted. */
  G2_PASSED = 'g2_passed',
  /** Field pilot signed off by citizen and government tester. */
  G3_PASSED = 'g3_passed',
  /** A maintenance owner has taken formal ownership. */
  G4_PASSED = 'g4_passed',
  /** Handed over, but not yet proven to be in continued use. */
  DEPLOYED = 'deployed',
  /** Terminal success: the six-month check-in confirmed continued use. */
  DEPLOYED_VERIFIED = 'deployed_verified',
  /** Stalled awaiting re-match or iteration after a failed gate. */
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
}

/** Terminal states — no further transition is legal. */
export const TERMINAL_PROJECT_STATES: readonly ProjectState[] = [
  ProjectState.DEPLOYED_VERIFIED,
  ProjectState.CANCELLED,
];

/**
 * The Structured Demand Profile and the project that grows out of it.
 *
 * A separate aggregate from `Issue` (ADR-0003): one project may absorb several
 * corroborating citizen reports, which the flowchart's "Return / Merge / Close"
 * branch at G1 requires and a single flat table cannot express.
 */
@Entity('projects')
@Unique('UQ_projects_reference', ['reference'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Human-quotable identifier, e.g. `JH-RAN-000123`. */
  @Column({ type: 'varchar', length: 40 })
  reference!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  problemStatement!: string;

  @Index()
  @Column({ type: 'enum', enum: ProjectState, default: ProjectState.G1_PASSED })
  state!: ProjectState;

  /**
   * The issue this profile was raised from. Additional merged issues are
   * recorded in `project_issues`.
   */
  @Column({ type: 'uuid' })
  originIssueId!: string;

  @ManyToOne(() => Issue, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'originIssueId' })
  originIssue!: Issue;

  /** Territorial unit the project belongs to — drives scoping (ADR-0015). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  orgUnitId!: string | null;

  @ManyToOne(() => OrgUnit, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgUnitId' })
  orgUnit!: OrgUnit | null;

  /**
   * Rises the longer a project sits unassigned (parameter.md §7). The scheduled
   * job that increments it lands with the queue in Phase 7.
   */
  @Column({ type: 'int', default: 1 })
  bountyMultiplier!: number;

  /** Awarded on G4_PASSED / DEPLOYED_VERIFIED only, never on ideation (§7). */
  @Column({ type: 'int', default: 0 })
  impactPoints!: number;

  @Column({ type: 'timestamptz', nullable: true })
  deployedAt!: Date | null;

  /** When the six-month adoption check-in is due (parameter.md §5, G4). */
  @Column({ type: 'timestamptz', nullable: true })
  adoptionCheckInDueAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Link table making the G1 merge branch expressible: several corroborating
 * issues can point at one project, exactly one of them flagged primary.
 */
@Entity('project_issues')
@Unique('UQ_project_issues', ['projectId', 'issueId'])
export class ProjectIssue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  issueId!: string;

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
