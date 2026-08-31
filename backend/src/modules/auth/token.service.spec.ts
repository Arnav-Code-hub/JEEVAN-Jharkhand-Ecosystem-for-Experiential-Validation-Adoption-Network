import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenActionError } from '../../shared/errors/domain.error';
import { Role } from '../../shared/rbac/role.enum';
import { AccessTokenPayload } from '../../shared/rbac/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { TokenService } from './token.service';

const CONFIG = {
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
} as const;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    role: Role.CITIZEN,
    orgUnitId: null,
    ...overrides,
  } as User;
}

describe('TokenService', () => {
  let redis: Redis;
  let jwt: JwtService;
  let service: TokenService;
  let users: { findByIdOrNull: jest.Mock; assertCanAuthenticate: jest.Mock };

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock shares one data store across instances; isolate each test.
    await redis.flushall();
    jwt = new JwtService({ secret: 'x'.repeat(48) });
    const config = {
      getOrThrow: <T>(key: keyof typeof CONFIG) => CONFIG[key] as unknown as T,
    } as unknown as ConfigService;

    // Rotation now re-checks the account, so a users stub is required.
    users = {
      findByIdOrNull: jest.fn().mockResolvedValue(makeUser()),
      assertCanAuthenticate: jest.fn(),
    };
    service = new TokenService(redis, jwt, users as never, config);
  });

  describe('issuePair', () => {
    it('issues an access token carrying role and org unit but no PII', async () => {
      const user = makeUser({ role: Role.GOVT_OFFICER, orgUnitId: 'org-9' });

      const { accessToken } = await service.issuePair(user);
      const payload = jwt.decode(accessToken) as AccessTokenPayload;

      expect(payload.sub).toBe('user-1');
      expect(payload.role).toBe(Role.GOVT_OFFICER);
      expect(payload.org).toBe('org-9');
      expect(payload.typ).toBe('access');
      expect(JSON.stringify(payload)).not.toMatch(/@|\+91/);
    });

    it('never stores the refresh token in plaintext', async () => {
      const { refreshToken } = await service.issuePair(makeUser());

      const keys = await redis.keys('*');
      const values = await Promise.all(
        keys.map(async (k) => ((await redis.type(k)) === 'string' ? redis.get(k) : null)),
      );

      expect(keys.join('|')).not.toContain(refreshToken);
      expect(values.join('|')).not.toContain(refreshToken);
    });
  });

  describe('rotate', () => {
    it('exchanges a refresh token for a new pair', async () => {
      const first = await service.issuePair(makeUser());

      const second = await service.rotate(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.accessToken).toBeTruthy();
    });

    it('invalidates the presented token', async () => {
      const first = await service.issuePair(makeUser());
      await service.rotate(first.refreshToken);

      await expect(service.rotate(first.refreshToken)).rejects.toThrow(ForbiddenActionError);
    });

    it('revokes the whole family when a spent token is replayed', async () => {
      const first = await service.issuePair(makeUser());
      const second = await service.rotate(first.refreshToken);

      // Attacker replays the stolen, already-rotated token.
      await expect(service.rotate(first.refreshToken)).rejects.toThrow(ForbiddenActionError);

      // The legitimate holder's current token is revoked too — deliberate.
      await expect(service.rotate(second.refreshToken)).rejects.toThrow(ForbiddenActionError);
    });

    it('rejects an unknown token', async () => {
      await expect(service.rotate('not-a-real-token')).rejects.toThrow(ForbiddenActionError);
    });

    it('preserves role and org unit across rotation', async () => {
      const user = makeUser({ role: Role.GOVT_STATE_ADMIN, orgUnitId: 'org-state' });
      users.findByIdOrNull.mockResolvedValue(user);
      const first = await service.issuePair(user);

      const second = await service.rotate(first.refreshToken);
      const payload = jwt.decode(second.accessToken) as AccessTokenPayload;

      expect(payload.role).toBe(Role.GOVT_STATE_ADMIN);
      expect(payload.org).toBe('org-state');
    });
  });

  describe('account revalidation on rotate', () => {
    it('revokes the family when the account no longer exists', async () => {
      const pair = await service.issuePair(makeUser());
      users.findByIdOrNull.mockResolvedValue(null);

      await expect(service.rotate(pair.refreshToken)).rejects.toThrow(ForbiddenActionError);
    });

    it('refuses rotation for a suspended account', async () => {
      const pair = await service.issuePair(makeUser());
      users.assertCanAuthenticate.mockImplementation(() => {
        throw new ForbiddenActionError('suspended');
      });

      await expect(service.rotate(pair.refreshToken)).rejects.toThrow(ForbiddenActionError);
    });

    it('picks up a role change from the database on rotation', async () => {
      const pair = await service.issuePair(makeUser({ role: Role.CITIZEN }));
      users.findByIdOrNull.mockResolvedValue(
        makeUser({ role: Role.GOVT_OFFICER, orgUnitId: 'ranchi' }),
      );

      const next = await service.rotate(pair.refreshToken);
      const payload = jwt.decode(next.accessToken) as AccessTokenPayload;

      expect(payload.role).toBe(Role.GOVT_OFFICER);
      expect(payload.org).toBe('ranchi');
    });
  });

  describe('revoke', () => {
    it('ends the session', async () => {
      const pair = await service.issuePair(makeUser());

      await service.revoke(pair.refreshToken);

      await expect(service.rotate(pair.refreshToken)).rejects.toThrow(ForbiddenActionError);
    });

    it('is silent for an unknown token', async () => {
      await expect(service.revoke('nope')).resolves.toBeUndefined();
    });
  });
});
