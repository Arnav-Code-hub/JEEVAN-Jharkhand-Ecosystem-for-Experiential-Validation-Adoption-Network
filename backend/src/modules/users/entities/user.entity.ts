import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../shared/rbac/role.enum';
import { OrgUnit } from './org-unit.entity';

export enum UserStatus {
  /** Created but not yet usable. Industry accounts start here (parameter.md §2). */
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

/**
 * The identity record that the whole RBAC layer hangs off.
 *
 * Citizens are keyed by phone, everyone else by email (parameter.md §2). Both
 * columns are nullable with partial unique indexes rather than a single
 * `identifier` column, so the database itself enforces that a phone belongs to
 * exactly one account.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'enum', enum: Role })
  role!: Role;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  /** E.164. Citizens only. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  /** Lowercased. Every role except citizen. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  fullName!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orgUnitId!: string | null;

  @ManyToOne(() => OrgUnit, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgUnitId' })
  orgUnit!: OrgUnit | null;

  /**
   * Base32 TOTP secret. Mandatory for government roles before they can hold a
   * session (parameter.md §2). Never leaves the server after enrolment.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  totpSecret!: string | null;

  @Column({ type: 'boolean', default: false })
  totpEnabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
