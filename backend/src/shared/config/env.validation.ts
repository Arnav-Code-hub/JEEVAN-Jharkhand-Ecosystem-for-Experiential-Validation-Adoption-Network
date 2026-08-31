import { randomBytes } from 'crypto';
import { z } from 'zod';

/**
 * Single source of truth for every environment variable the backend reads.
 *
 * Validated once at boot by `ConfigModule.forRoot({ validate })`. A missing or
 * malformed variable fails startup with a named error rather than surfacing as a
 * confusing runtime failure at first use. Nothing outside this file should read
 * `process.env` directly — inject `ConfigService<Env, true>` instead.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    // ---- PostgreSQL (ADR-0001: self-hosted, no Supabase) -------------------
    DB_HOST: z.string().min(1, 'DB_HOST is required'),
    DB_PORT: z.coerce.number().int().positive(),
    DB_USERNAME: z.string().min(1, 'DB_USERNAME is required'),
    DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
    DB_NAME: z.string().min(1, 'DB_NAME is required'),

    // ---- HTTP ---------------------------------------------------------------
    /** Comma-separated list of allowed origins, or `*` to allow any. */
    CORS_ORIGINS: z.string().default('*'),
    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

    // ---- Observability ------------------------------------------------------
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // ---- Redis (ADR-0004: OTP state + refresh tokens) ----------------------
    REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // ---- OTP ----------------------------------------------------------------
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

    // ---- Object storage (ADR-0005: MinIO locally, S3 in production) --------
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().default('ap-south-1'),
    STORAGE_BUCKET: z.string().min(1, 'STORAGE_BUCKET is required'),
    STORAGE_ACCESS_KEY: z.string().min(1, 'STORAGE_ACCESS_KEY is required'),
    STORAGE_SECRET_KEY: z.string().min(1, 'STORAGE_SECRET_KEY is required'),

    // ---- Media limits -------------------------------------------------------
    MEDIA_MAX_IMAGE_MB: z.coerce.number().int().positive().default(10),
    MEDIA_MAX_VIDEO_MB: z.coerce.number().int().positive().default(100),
    MEDIA_MAX_AUDIO_MB: z.coerce.number().int().positive().default(20),
    MEDIA_MAX_DOCUMENT_MB: z.coerce.number().int().positive().default(15),

    // ---- Corroboration (ADR-0006) -------------------------------------------
    CORROBORATION_RADIUS_METRES: z.coerce.number().int().positive().default(500),
    CORROBORATION_WINDOW_DAYS: z.coerce.number().int().positive().default(30),

    // ---- Governance (ADR-0007) ---------------------------------------------
    /** Org-unit tier whose officers own the G1 gate. */
    G1_OWNER_TIER: z.enum(['state', 'district', 'block', 'panchayat']).default('district'),

    // ---- Auth ----------------------------------------------------------------
    /**
     * Required in production. In development an ephemeral secret is generated at
     * boot so a fresh clone runs without setup — tokens simply do not survive a
     * restart. A hardcoded default is deliberately NOT provided: a well-known
     * signing key is worse than no key at all.
     */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    JWT_EXPIRES_IN: z.string().default('15m'),
    /** Access-token lifetime. Short, because it cannot be revoked (ADR-0004). */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    /** Refresh-token lifetime. Long, but revocable and rotated on every use. */
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required when NODE_ENV=production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule. Throws with every problem listed at once, rather than
 * failing on the first one, so a misconfigured deploy is fixed in a single pass.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const env = result.data;

  // Resolve the effective signing secret exactly once, here, so every consumer
  // (JwtModule, JwtStrategy, the enrolment-token signer) shares the same value.
  // Production already required it above; in development an ephemeral secret is
  // generated per boot rather than shipping a well-known default.
  if (!env.JWT_SECRET) {
    env.JWT_SECRET = randomBytes(48).toString('hex');
    // eslint-disable-next-line no-console
    console.warn(
      '[config] JWT_SECRET is not set — generated an ephemeral development secret. ' +
        'Sessions will not survive a restart. Set JWT_SECRET before deploying.',
    );
  }

  return env;
}
