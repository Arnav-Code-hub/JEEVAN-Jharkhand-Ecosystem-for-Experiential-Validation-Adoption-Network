import { validateEnv } from './env.validation';

const VALID_SECRET = 'a'.repeat(32);

/** Minimum set of variables a boot requires. */
const baseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'secret',
  DB_NAME: 'jeevan',
  REDIS_HOST: 'localhost',
  STORAGE_BUCKET: 'jeevan-media',
  STORAGE_ACCESS_KEY: 'key',
  STORAGE_SECRET_KEY: 'secret',
};

describe('validateEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = validateEnv({ ...baseEnv });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.THROTTLE_TTL_SECONDS).toBe(60);
    expect(env.REDIS_PORT).toBe(6379);
    expect(env.OTP_TTL_SECONDS).toBe(300);
    expect(env.OTP_MAX_ATTEMPTS).toBe(5);
    // ADR-0007: the G1-owning tier is configuration, defaulting to district.
    expect(env.G1_OWNER_TIER).toBe('district');
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    // ADR-0005 / ADR-0006 defaults.
    expect(env.STORAGE_REGION).toBe('ap-south-1');
    expect(env.MEDIA_MAX_IMAGE_MB).toBe(10);
    expect(env.CORROBORATION_RADIUS_METRES).toBe(500);
    expect(env.CORROBORATION_WINDOW_DAYS).toBe(30);
  });

  it('coerces numeric strings to numbers', () => {
    const env = validateEnv({ ...baseEnv, DB_PORT: '6543', PORT: '8080' });

    expect(env.DB_PORT).toBe(6543);
    expect(env.PORT).toBe(8080);
  });

  describe('required database settings', () => {
    it.each(Object.keys(baseEnv))('fails when %s is missing', (key) => {
      const incomplete = { ...baseEnv };
      delete (incomplete as Record<string, unknown>)[key];

      expect(() => validateEnv(incomplete)).toThrow(key);
    });

    it('rejects a non-numeric DB_PORT', () => {
      expect(() => validateEnv({ ...baseEnv, DB_PORT: 'not-a-number' })).toThrow('DB_PORT');
    });
  });

  describe('JWT_SECRET', () => {
    it('is optional in development, and an ephemeral secret is generated', () => {
      const env = validateEnv({ ...baseEnv, NODE_ENV: 'development' });

      // A hardcoded fallback would be worse than none; assert it is random.
      expect(env.JWT_SECRET).toHaveLength(96);
      expect(validateEnv({ ...baseEnv }).JWT_SECRET).not.toBe(env.JWT_SECRET);
    });

    it('keeps an explicitly configured secret unchanged', () => {
      const env = validateEnv({ ...baseEnv, JWT_SECRET: VALID_SECRET });

      expect(env.JWT_SECRET).toBe(VALID_SECRET);
    });

    it('is required in production', () => {
      expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
        'JWT_SECRET is required when NODE_ENV=production',
      );
    });

    it('rejects a secret shorter than 32 characters', () => {
      expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'too-short' })).toThrow('JWT_SECRET');
    });

    it('accepts a sufficiently long secret in production', () => {
      expect(() =>
        validateEnv({ ...baseEnv, NODE_ENV: 'production', JWT_SECRET: VALID_SECRET }),
      ).not.toThrow();
    });
  });

  it('reports every problem at once rather than failing on the first', () => {
    let message = '';
    try {
      validateEnv({ DB_HOST: 'localhost', DB_PORT: 'nope' });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain('DB_PORT');
    expect(message).toContain('DB_USERNAME');
    expect(message).toContain('DB_PASSWORD');
    expect(message).toContain('DB_NAME');
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ ...baseEnv, LOG_LEVEL: 'verbose' })).toThrow('LOG_LEVEL');
  });

  it('requires REDIS_HOST, since OTP and refresh tokens depend on it', () => {
    const withoutRedis = { ...baseEnv };
    delete (withoutRedis as Record<string, unknown>).REDIS_HOST;

    expect(() => validateEnv(withoutRedis)).toThrow('REDIS_HOST');
  });

  it.each(['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'])(
    'requires %s, since media evidence depends on object storage',
    (key) => {
      const without = { ...baseEnv };
      delete (without as Record<string, unknown>)[key];

      expect(() => validateEnv(without)).toThrow(key);
    },
  );

  it('defaults the storage region to ap-south-1 for data localisation', () => {
    // MeitY / ADR-0014: citizen media must not leave the country by default.
    expect(validateEnv({ ...baseEnv }).STORAGE_REGION).toBe('ap-south-1');
  });

  it('rejects an org tier that cannot own G1', () => {
    expect(() => validateEnv({ ...baseEnv, G1_OWNER_TIER: 'hei' })).toThrow('G1_OWNER_TIER');
  });
});
