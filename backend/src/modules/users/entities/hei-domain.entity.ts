import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OrgUnit } from './org-unit.entity';

/**
 * Allowlist of institutional email domains (parameter.md §2, ADR-0010).
 *
 * An email whose domain appears here authenticates as a student; anything else
 * self-registers as an industry account pending admin verification. Seeded, and
 * extensible at runtime through admin CRUD so onboarding a new HEI is not a
 * deploy.
 */
@Entity('hei_domains')
@Unique('UQ_hei_domains_domain', ['domain'])
export class HeiDomain {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Bare domain, lowercased, no `@`. e.g. `bitmesra.ac.in`. */
  @Column({ type: 'varchar', length: 255 })
  domain!: string;

  @Column({ type: 'varchar', length: 200 })
  institutionName!: string;

  /** The HEI-tier org unit students of this domain are attached to. */
  @Column({ type: 'uuid', nullable: true })
  orgUnitId!: string | null;

  @ManyToOne(() => OrgUnit, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orgUnitId' })
  orgUnit!: OrgUnit | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
