import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  BusinessRuleViolationError,
  DomainError,
  ForbiddenActionError,
  ResourceNotFoundError,
  StateConflictError,
  UpstreamServiceError,
} from '../errors/domain.error';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  requestId?: string;
  path: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

const DOMAIN_STATUS: ReadonlyArray<[new (...args: never[]) => DomainError, HttpStatus]> = [
  [ResourceNotFoundError, HttpStatus.NOT_FOUND],
  [ForbiddenActionError, HttpStatus.FORBIDDEN],
  [StateConflictError, HttpStatus.CONFLICT],
  [BusinessRuleViolationError, HttpStatus.UNPROCESSABLE_ENTITY],
  [UpstreamServiceError, HttpStatus.BAD_GATEWAY],
];

/**
 * Produces one consistent error envelope for every failure mode, and guarantees
 * that internal details never reach the client.
 *
 * Every response carries the request id, so a user-reported error can be traced
 * to the exact log line that produced it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const body = this.toErrorBody(exception, request);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Unexpected: log the whole thing, return nothing revealing.
      this.logger.error(
        { err: exception, requestId: body.requestId, path: body.path },
        'Unhandled exception',
      );
    } else {
      this.logger.warn(
        { code: body.code, requestId: body.requestId, path: body.path },
        'Request failed',
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, request: Request & { id?: string }): ErrorBody {
    const base = {
      requestId: request.id,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof DomainError) {
      const match = DOMAIN_STATUS.find(([type]) => exception instanceof type);
      return {
        ...base,
        statusCode: match ? match[1] : HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      // ValidationPipe returns { message: string[], error, statusCode }.
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? ((payload as { message: string | string[] }).message ?? exception.message)
          : exception.message;

      return {
        ...base,
        statusCode: status,
        code: this.httpCodeFor(status),
        message,
      };
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      // Deliberately generic: never leak a stack trace or driver message.
      message: 'An unexpected error occurred.',
    };
  }

  private httpCodeFor(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_FAILED';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN_ACTION';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'STATE_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }
}
