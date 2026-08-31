import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { BusinessRuleViolationError } from '../../shared/errors/domain.error';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import { OTP_PROVIDER, OtpChannel, OtpProvider } from './providers/otp.provider';

interface StoredOtp {
  hash: string;
  attempts: number;
}

/**
 * Redis-backed one-time codes.
 *
 * Replaces the pre-Phase-2 in-memory `Map`, which had no expiry, no attempt
 * limit, lost all state on restart, could not work across instances, and fell
 * back to a static `123456` that authenticated any phone number.
 */
@Injectable()
export class OtpService {
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly cooldownSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.getOrThrow<number>('OTP_TTL_SECONDS');
    this.maxAttempts = config.getOrThrow<number>('OTP_MAX_ATTEMPTS');
    this.cooldownSeconds = config.getOrThrow<number>('OTP_RESEND_COOLDOWN_SECONDS');
  }

  /**
   * Issues a code and hands it to the delivery provider. The code is never
   * returned to the caller.
   */
  async issue(identifier: string, channel: OtpChannel): Promise<{ expiresInSeconds: number }> {
    const cooldownKey = this.cooldownKey(identifier);

    // NX makes this atomic: the first caller sets the cooldown, everyone else
    // inside the window is rejected without a race.
    const acquired = await this.redis.set(cooldownKey, '1', 'EX', this.cooldownSeconds, 'NX');
    if (acquired !== 'OK') {
      const retryIn = await this.redis.ttl(cooldownKey);
      throw new BusinessRuleViolationError(
        `Please wait ${Math.max(retryIn, 1)}s before requesting another code.`,
        { retryInSeconds: Math.max(retryIn, 1) },
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const payload: StoredOtp = { hash: this.hash(identifier, code), attempts: 0 };

    await this.redis.set(this.otpKey(identifier), JSON.stringify(payload), 'EX', this.ttlSeconds);
    await this.provider.send(channel, identifier, code);

    return { expiresInSeconds: this.ttlSeconds };
  }

  /**
   * Validates a code without spending it.
   *
   * Deliberately separate from {@link consume} because an elevated account has a
   * second factor still to clear. Deleting the code here would strand that user:
   * their OTP would be gone before they could supply their TOTP.
   */
  async verify(identifier: string, code: string): Promise<void> {
    const key = this.otpKey(identifier);
    const raw = await this.redis.get(key);

    if (!raw) {
      // Covers both "never requested" and "expired". Deliberately the same
      // message, so the response does not reveal whether an account exists.
      throw new BusinessRuleViolationError('That code is invalid or has expired.');
    }

    const stored = JSON.parse(raw) as StoredOtp;

    if (stored.attempts + 1 >= this.maxAttempts) {
      await this.redis.del(key);
      throw new BusinessRuleViolationError('Too many incorrect attempts. Request a new code.');
    }

    if (!this.matches(stored.hash, this.hash(identifier, code))) {
      stored.attempts += 1;
      // Preserve the original expiry — a wrong guess must not extend the window.
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
      throw new BusinessRuleViolationError('That code is invalid or has expired.');
    }
  }

  /**
   * Spends a code so it cannot be replayed. Called only once every factor has
   * passed and a session is actually being issued.
   */
  async consume(identifier: string): Promise<void> {
    await this.redis.del(this.otpKey(identifier));
  }

  /**
   * Bound to the identifier so a code issued for one phone cannot be replayed
   * against another.
   */
  private hash(identifier: string, code: string): string {
    return createHash('sha256').update(`${identifier}:${code}`).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  private otpKey(identifier: string): string {
    return `otp:${createHash('sha256').update(identifier).digest('hex')}`;
  }

  private cooldownKey(identifier: string): string {
    return `otp:cooldown:${createHash('sha256').update(identifier).digest('hex')}`;
  }
}
