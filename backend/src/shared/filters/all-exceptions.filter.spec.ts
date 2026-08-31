import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
  StateConflictError,
  UpstreamServiceError,
} from '../errors/domain.error';

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

function makeHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = { status: 0, body: {} };

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
  };

  const request = { id: 'req-abc-123', url: '/api/v1/issues' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // The filter logs expected failures; silence it for readable test output.
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('always includes the request id, path and timestamp', () => {
    const { host, captured } = makeHost();

    filter.catch(new NotFoundException('nope'), host);

    expect(captured.body.requestId).toBe('req-abc-123');
    expect(captured.body.path).toBe('/api/v1/issues');
    expect(typeof captured.body.timestamp).toBe('string');
  });

  describe('domain errors map to the right status', () => {
    it.each([
      [new ResourceNotFoundError('missing'), HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND'],
      [new StateConflictError('bad transition'), HttpStatus.CONFLICT, 'STATE_CONFLICT'],
      [
        new BusinessRuleViolationError('rule'),
        HttpStatus.UNPROCESSABLE_ENTITY,
        'BUSINESS_RULE_VIOLATION',
      ],
      [new UpstreamServiceError('ml down'), HttpStatus.BAD_GATEWAY, 'UPSTREAM_SERVICE_ERROR'],
    ])('%s', (error, expectedStatus, expectedCode) => {
      const { host, captured } = makeHost();

      filter.catch(error, host);

      expect(captured.status).toBe(expectedStatus);
      expect(captured.body.code).toBe(expectedCode);
    });
  });

  it('passes through domain error details', () => {
    const { host, captured } = makeHost();

    filter.catch(new StateConflictError('illegal', { from: 'SUBMITTED', to: 'G3_PASSED' }), host);

    expect(captured.body.details).toEqual({ from: 'SUBMITTED', to: 'G3_PASSED' });
  });

  it('preserves ValidationPipe message arrays', () => {
    const { host, captured } = makeHost();

    filter.catch(new BadRequestException(['title must be a string']), host);

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body.code).toBe('VALIDATION_FAILED');
    expect(captured.body.message).toEqual(['title must be a string']);
  });

  it('never leaks internal details from an unknown error', () => {
    const { host, captured } = makeHost();

    filter.catch(new Error('connection string postgres://user:hunter2@db'), host);

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body.code).toBe('INTERNAL_ERROR');
    expect(captured.body.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(captured.body)).not.toContain('hunter2');
  });
});
