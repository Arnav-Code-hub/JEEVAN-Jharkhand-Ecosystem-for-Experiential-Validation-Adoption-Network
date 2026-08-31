import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundError } from '../../shared/errors/domain.error';
import { OrgUnit, OrgUnitTier } from './entities/org-unit.entity';

@Injectable()
export class OrgUnitsService {
  constructor(
    @InjectRepository(OrgUnit)
    private readonly repo: Repository<OrgUnit>,
  ) {}

  findByCode(code: string): Promise<OrgUnit | null> {
    return this.repo.findOneBy({ code });
  }

  async findById(id: string): Promise<OrgUnit> {
    const unit = await this.repo.findOneBy({ id });
    if (!unit) throw new ResourceNotFoundError(`Org unit ${id} not found`);
    return unit;
  }

  findByTier(tier: OrgUnitTier): Promise<OrgUnit[]> {
    return this.repo.find({ where: { tier, isActive: true }, order: { name: 'ASC' } });
  }

  findChildren(parentId: string): Promise<OrgUnit[]> {
    return this.repo.find({ where: { parentId, isActive: true }, order: { name: 'ASC' } });
  }

  /**
   * Every unit in the subtree rooted at `id`, itself included.
   *
   * Uses the materialised `path` prefix rather than a recursive CTE, so scope
   * resolution stays a single indexed scan (ADR-0015).
   */
  async findSubtreeIds(id: string): Promise<string[]> {
    const root = await this.findById(id);
    const rows = await this.repo
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('u.path = :path OR u.path LIKE :prefix', {
        path: root.path,
        prefix: `${root.path}/%`,
      })
      .getRawMany<{ id: string }>();

    return rows.map((r) => r.id);
  }

  /** True when `descendantId` sits at or below `ancestorId`. */
  async isWithin(descendantId: string, ancestorId: string): Promise<boolean> {
    if (descendantId === ancestorId) return true;
    const [descendant, ancestor] = await Promise.all([
      this.findById(descendantId),
      this.findById(ancestorId),
    ]);
    return descendant.path.startsWith(`${ancestor.path}/`);
  }

  /** Builds the `path` a unit should carry, given its parent. */
  static buildPath(code: string, parent: OrgUnit | null): string {
    return parent ? `${parent.path}/${code}` : code;
  }
}
