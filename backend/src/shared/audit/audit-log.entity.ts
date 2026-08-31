import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../rbac/role.enum';

/**
 * Append-only record of every privileged action.
 *
 * The gated governance model is only meaningful if gate decisions are
 * attributable and immutable, so this table is written but never updated or
 * deleted. The gate engine in Phase 5 records its transitions here.
 *
 * `metadata` must never contain citizen PII (parameter.md §8) — store entity
 * ids and rule outcomes, not names, phone numbers, or addresses.
 */
@Entity('audit_log')
export class AuditLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Null for unauthenticated actions such as a failed OTP verification. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'enum', enum: Role, nullable: true })
  actorRole!: Role | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorOrgUnitId!: string | null;

  /** Dotted action name, e.g. `auth.otp.verify` or `gate.g1.pass`. */
  @Index()
  @Column({ type: 'varchar', length: 120 })
  action!: string;

  /** Aggregate type the action targeted, e.g. `issue`, `user`. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  resourceType!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
