import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntry } from './audit-log.entity';
import { AuthenticatedUser } from '../rbac/rbac.decorators';

export interface AuditRecord {
  action: string;
  actor?: AuthenticatedUser | null;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntry)
    private readonly repo: Repository<AuditLogEntry>,
  ) {}

  /**
   * Writes an audit row. Deliberately never throws: an audit failure must not
   * roll back the action the user actually requested. It is logged at error
   * level instead, so a broken audit path is still loud.
   */
  async record(entry: AuditRecord): Promise<void> {
    try {
      // `save` rather than `insert`: the jsonb column's deep-partial typing on
      // insert() rejects an arbitrary Record.
      await this.repo.save(
        this.repo.create({
          action: entry.action,
          actorId: entry.actor?.userId ?? null,
          actorRole: entry.actor?.role ?? null,
          actorOrgUnitId: entry.actor?.orgUnitId ?? null,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          success: entry.success ?? true,
          requestId: entry.requestId ?? null,
          metadata: entry.metadata ?? null,
        }),
      );
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Failed to write audit entry');
    }
  }
}
