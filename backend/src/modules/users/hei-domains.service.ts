import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
  StateConflictError,
} from '../../shared/errors/domain.error';
import { HeiDomain } from './entities/hei-domain.entity';

@Injectable()
export class HeiDomainsService {
  constructor(
    @InjectRepository(HeiDomain)
    private readonly repo: Repository<HeiDomain>,
  ) {}

  /** Extracts and normalises the domain part of an email address. */
  static domainOf(email: string): string {
    const at = email.lastIndexOf('@');
    if (at < 0) throw new BusinessRuleViolationError('Not a valid email address');
    return email.slice(at + 1).toLowerCase();
  }

  /** Returns the allowlist entry for an email, or null if not an HEI address. */
  findForEmail(email: string): Promise<HeiDomain | null> {
    return this.repo.findOneBy({ domain: HeiDomainsService.domainOf(email), isActive: true });
  }

  findAll(): Promise<HeiDomain[]> {
    return this.repo.find({ order: { institutionName: 'ASC' } });
  }

  async create(input: {
    domain: string;
    institutionName: string;
    orgUnitId?: string | null;
  }): Promise<HeiDomain> {
    const domain = input.domain.trim().toLowerCase().replace(/^@/, '');

    if (await this.repo.findOneBy({ domain })) {
      throw new StateConflictError(`Domain ${domain} is already on the allowlist`);
    }

    return this.repo.save(
      this.repo.create({
        domain,
        institutionName: input.institutionName,
        orgUnitId: input.orgUnitId ?? null,
        isActive: true,
      }),
    );
  }

  async setActive(id: string, isActive: boolean): Promise<HeiDomain> {
    const entry = await this.repo.findOneBy({ id });
    if (!entry) throw new ResourceNotFoundError(`HEI domain ${id} not found`);

    entry.isActive = isActive;
    return this.repo.save(entry);
  }
}
