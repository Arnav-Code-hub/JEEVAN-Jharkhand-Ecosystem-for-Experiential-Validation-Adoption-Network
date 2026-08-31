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

/**
 * Administrative tiers (ADR-0007).
 *
 * Territorial tiers form a strict hierarchy; HEI is non-territorial and hangs
 * off a district. Encoding the tier as data is what lets the G1-owning body be
 * configuration rather than a hardcoded role — resolving the contradiction
 * between the flowchart (Grampanchayat) and parameter.md §5 (District
 * Innovation Cell).
 */
export enum OrgUnitTier {
  STATE = 'state',
  DISTRICT = 'district',
  BLOCK = 'block',
  PANCHAYAT = 'panchayat',
  HEI = 'hei',
}

/** Territorial tiers ordered from broadest to narrowest. */
export const TERRITORIAL_TIERS: readonly OrgUnitTier[] = [
  OrgUnitTier.STATE,
  OrgUnitTier.DISTRICT,
  OrgUnitTier.BLOCK,
  OrgUnitTier.PANCHAYAT,
];

@Entity('org_units')
@Unique('UQ_org_units_code', ['code'])
export class OrgUnit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable slug, e.g. `jh`, `jh-ranchi`, `jh-ranchi-kanke`. Seeds key on this. */
  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Index()
  @Column({ type: 'enum', enum: OrgUnitTier })
  tier!: OrgUnitTier;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => OrgUnit, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentId' })
  parent!: OrgUnit | null;

  /**
   * Materialised ancestor path, e.g. `jh/jh-ranchi/jh-ranchi-kanke`. Lets a
   * subtree scope check be a single indexed prefix match instead of a recursive
   * CTE on every list query (ADR-0015).
   */
  @Index()
  @Column({ type: 'varchar', length: 512 })
  path!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
