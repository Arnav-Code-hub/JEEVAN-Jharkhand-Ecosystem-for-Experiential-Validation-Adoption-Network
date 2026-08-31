import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IssueStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

export enum IssueCategory {
  WATER = 'water',
  ROADS = 'roads',
  ELECTRICITY = 'electricity',
  SANITATION = 'sanitation',
  EDUCATION = 'education',
  HEALTHCARE = 'healthcare',
  AGRICULTURE = 'agriculture',
  OTHER = 'other',
}

export enum IntakeChannel {
  WEB = 'web',
  MOBILE = 'mobile',
  WHATSAPP = 'whatsapp',
  VOICE = 'voice',
}

/**
 * Renamed from `CitizenIssue` / table `citizen_issues`. The entity belongs to the
 * `issues` domain, not to the citizen role — government, HEI, and industry roles
 * all read it. Role is enforced in the RBAC layer, not in the entity name.
 *
 * The status enum still carries the legacy vocabulary (`verified`/`resolved`).
 * Migrating to the documented gate vocabulary (G1_PASSED .. DEPLOYED_VERIFIED)
 * and splitting Issue from Project is Phase 3/5 of implementation_plan.md.
 */
@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Client-generated idempotency key for offline sync.
   *
   * Without it, a mobile client retrying a queued submission on a flaky rural
   * connection creates duplicate issues - which also inflates the corroboration
   * count that G1 depends on, so a retry storm could manufacture its own
   * evidence.
   */
  @Column({ type: 'uuid', nullable: true })
  clientId!: string | null;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column({ type: 'enum', enum: IssueCategory })
  category!: IssueCategory;

  @Column({ type: 'enum', enum: IssueStatus, default: IssueStatus.SUBMITTED })
  status!: IssueStatus;

  @Column({ type: 'enum', enum: IntakeChannel, default: IntakeChannel.WEB })
  channel!: IntakeChannel;

  // Geotagging
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', nullable: true })
  block!: string | null;

  // Reporter info
  /** FK to users.id. Populated from the access token, never from the body. */
  @Column({ type: 'uuid', nullable: true })
  reportedByUserId!: string | null;

  @Column()
  citizenName!: string;

  @Column({ type: 'varchar', nullable: true })
  citizenPhone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  citizenEmail!: string | null;

  // Attachments (URLs)
  // AI triage
  @Column({ type: 'real', nullable: true })
  urgencyScore!: number | null;

  @Column({ default: false })
  isEmergency!: boolean;

  @Column({ type: 'varchar', nullable: true })
  aiSummary!: string | null;

  // G1 gate
  @Column({ type: 'varchar', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
