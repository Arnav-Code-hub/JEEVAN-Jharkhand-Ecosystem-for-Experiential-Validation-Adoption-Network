import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { DomainError } from '../errors/domain.error';
import { AuthenticatedUser } from '../rbac/rbac.decorators';
import { AuditService } from './audit.service';

export const AUDIT_KEY = 'audit:options';

export interface AuditOptions {
  /** Dotted action name, e.g. `auth.otp.verify`. */
  action: string;
  resourceType?: string;
  /** Route parameter holding the resource id, e.g. `id`. */
  resourceIdParam?: string;
  /**
   * Derives the resource id and extra metadata from a successful result.
   * Must never return PII (parameter.md §8).
   */
  fromResult?: (result: unknown) => { resourceId?: string; metadata?: Record<string, unknown> };
}

/**
 * Marks a route for audit logging. The interceptor records both outcomes, so a
 * rejected sign-in or a refused gate decision leaves a trail — previously these
 * threw before the controller's manual `audit.record` call could run, and were
 * silently absent from the table.
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditOptions | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<
        Request & { id?: string; user?: AuthenticatedUser; params: Record<string, string> }
      >();

    const base = {
      action: options.action,
      actor: request.user ?? null,
      resourceType: options.resourceType,
      requestId: request.id,
      resourceId: options.resourceIdParam ? request.params?.[options.resourceIdParam] : undefined,
    };

    return next.handle().pipe(
      tap({
        next: (result) => {
          const derived = options.fromResult?.(result) ?? {};
          void this.audit.record({
            ...base,
            resourceId: derived.resourceId ?? base.resourceId,
            success: true,
            metadata: derived.metadata,
          });
        },
        error: (error: unknown) => {
          void this.audit.record({
            ...base,
            success: false,
            // The reason, not the input: an audit row must never capture the
            // rejected credential or the citizen's identifier.
            metadata: { reason: AuditInterceptor.reasonFor(error) },
          });
        },
      }),
    );
  }

  private static reasonFor(error: unknown): string {
    if (error instanceof DomainError) return error.code;
    if (error && typeof error === 'object' && 'status' in error) {
      return `HTTP_${(error as { status: number }).status}`;
    }
    return 'INTERNAL_ERROR';
  }
}
