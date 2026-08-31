import { createHash, randomBytes, randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { ForbiddenActionError } from '../../shared/errors/domain.error';
import { AccessTokenPayload } from '../../shared/rbac/jwt.strategy';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import { Role } from '../../shared/rbac/role.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshRecord {
  userId: string;
  familyId: string;
  role: Role;
  orgUnitId: string | null;
}

/**
 * Access + rotating refresh tokens (ADR-0004).
 *
 * Access tokens are stateless JWTs carrying no PII. Refresh tokens are opaque
 * random strings, stored server-side by hash so a Redis dump does not yield
 * usable credentials, and rotated on every use.
 *
 * Reuse of an already-rotated refresh token is treated as theft: the entire
 * token family is revoked, which logs out both the attacker and the legitimate
 * holder. That is the correct trade-off for a system where an admin session can
 * approve governance gates.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    this.refreshTtlSeconds = config.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS');
  }

  /** Starts a new session — a new token family. */
  async issuePair(user: User): Promise<TokenPair> {
    return this.mint(user.id, user.role, user.orgUnitId, randomUUID());
  }

  /**
   * Exchanges a refresh token for a fresh pair, invalidating the presented one.
   */
  async rotate(presentedToken: string): Promise<TokenPair> {
    const tokenHash = this.hash(presentedToken);
    const activeKey = this.activeKey(tokenHash);

    const raw = await this.redis.get(activeKey);

    if (!raw) {
      // Not active. If we recognise it as already-spent, this is a replay.
      const usedFamily = await this.redis.get(this.usedKey(tokenHash));
      if (usedFamily) {
        this.logger.warn(
          { familyId: usedFamily },
          'Refresh token reuse detected — revoking family',
        );
        await this.revokeFamily(usedFamily);
        throw new ForbiddenActionError('Session revoked. Please sign in again.');
      }
      throw new ForbiddenActionError('Invalid or expired refresh token.');
    }

    const record = JSON.parse(raw) as RefreshRecord;

    // Re-check the account on every rotation. Without this, a deleted or
    // suspended user could refresh indefinitely, and a role change would never
    // take effect. This is the counterpart to JwtStrategy skipping the DB.
    const user = await this.users.findByIdOrNull(record.userId);
    if (!user) {
      await this.revokeFamily(record.familyId);
      throw new ForbiddenActionError('Session revoked. Please sign in again.');
    }
    this.users.assertCanAuthenticate(user);

    // Retire the presented token before minting its replacement.
    await this.redis
      .multi()
      .del(activeKey)
      .srem(this.familyKey(record.familyId), tokenHash)
      .set(this.usedKey(tokenHash), record.familyId, 'EX', this.refreshTtlSeconds)
      .exec();

    // Role and org unit are re-read from the database, not replayed from Redis.
    return this.mint(user.id, user.role, user.orgUnitId, record.familyId);
  }

  /** Ends one session. */
  async revoke(presentedToken: string): Promise<void> {
    const tokenHash = this.hash(presentedToken);
    const raw = await this.redis.get(this.activeKey(tokenHash));
    if (!raw) return;

    const record = JSON.parse(raw) as RefreshRecord;
    await this.revokeFamily(record.familyId);
  }

  /** Ends every session in a family. */
  async revokeFamily(familyId: string): Promise<void> {
    const familyKey = this.familyKey(familyId);
    const hashes = await this.redis.smembers(familyKey);

    const pipeline = this.redis.multi();
    for (const hash of hashes) {
      pipeline.del(this.activeKey(hash));
    }
    pipeline.del(familyKey);
    await pipeline.exec();
  }

  private async mint(
    userId: string,
    role: Role,
    orgUnitId: string | null,
    familyId: string,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId, role, org: orgUnitId, typ: 'access' };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hash(refreshToken);
    const record: RefreshRecord = { userId, familyId, role, orgUnitId };

    await this.redis
      .multi()
      .set(this.activeKey(tokenHash), JSON.stringify(record), 'EX', this.refreshTtlSeconds)
      .sadd(this.familyKey(familyId), tokenHash)
      .expire(this.familyKey(familyId), this.refreshTtlSeconds)
      .sadd(this.userKey(userId), familyId)
      .expire(this.userKey(userId), this.refreshTtlSeconds)
      .exec();

    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds };
  }

  /** Ends every session a user holds — used when an account is suspended or reset. */
  async revokeAllForUser(userId: string): Promise<void> {
    const families = await this.redis.smembers(this.userKey(userId));
    await Promise.all(families.map((familyId) => this.revokeFamily(familyId)));
    await this.redis.del(this.userKey(userId));
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private activeKey(tokenHash: string): string {
    return `rt:active:${tokenHash}`;
  }

  private usedKey(tokenHash: string): string {
    return `rt:used:${tokenHash}`;
  }

  private familyKey(familyId: string): string {
    return `rt:family:${familyId}`;
  }

  private userKey(userId: string): string {
    return `rt:user:${userId}`;
  }
}
