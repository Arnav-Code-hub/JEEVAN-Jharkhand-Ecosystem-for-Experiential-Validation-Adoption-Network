import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

/** Header a caller may set to propagate an existing trace id inwards. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured JSON logging with a correlation id on every line.
 *
 * The id is echoed back on the response and included in every error envelope, so
 * a user-reported failure maps to exact log lines. When the AI gateway lands in
 * Phase 4 it forwards this same id to the ML service, making a request traceable
 * across both processes.
 */
export interface LoggerOptionsInput {
  isProduction: boolean;
  level: string;
}

export function buildLoggerOptions({ isProduction, level }: LoggerOptionsInput): Params {
  return {
    pinoHttp: {
      level,

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers[REQUEST_ID_HEADER];
        const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },

      // parameter.md §8: never let credentials or citizen PII reach the logs.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.otp',
          'req.body.citizenPhone',
          'req.body.citizenEmail',
          'req.body.phone',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },

      autoLogging: {
        // Health checks would otherwise dominate the log volume.
        ignore: (req: IncomingMessage) => req.url === '/health',
      },

      // Human-readable in development, one JSON object per line in production so
      // a log shipper can parse it.
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
          },
    },
  };
}
