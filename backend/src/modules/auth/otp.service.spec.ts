import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { BusinessRuleViolationError } from '../../shared/errors/domain.error';
import { OtpService } from './otp.service';
import { OtpChannel, OtpProvider } from './providers/otp.provider';

/** Captures the issued code, which the service never returns to callers. */
class CapturingProvider implements OtpProvider {
  public sent: Array<{ channel: OtpChannel; destination: string; code: string }> = [];

  async send(channel: OtpChannel, destination: string, code: string): Promise<void> {
    this.sent.push({ channel, destination, code });
  }

  get lastCode(): string {
    return this.sent[this.sent.length - 1].code;
  }
}

const CONFIG = {
  OTP_TTL_SECONDS: 300,
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
} as const;

describe('OtpService', () => {
  let redis: Redis;
  let provider: CapturingProvider;
  let service: OtpService;
  const phone = '+919876543210';

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock shares one data store across instances; isolate each test.
    await redis.flushall();
    provider = new CapturingProvider();
    const config = {
      getOrThrow: <T>(key: keyof typeof CONFIG) => CONFIG[key] as unknown as T,
    } as unknown as ConfigService;

    service = new OtpService(redis, provider, config);
  });

  describe('issue', () => {
    it('generates a six-digit code and hands it to the provider', async () => {
      await service.issue(phone, 'sms');

      expect(provider.sent).toHaveLength(1);
      expect(provider.lastCode).toMatch(/^\d{6}$/);
    });

    it('never stores the code in plaintext', async () => {
      await service.issue(phone, 'sms');

      const keys = await redis.keys('*');
      const values = await Promise.all(keys.map((k) => redis.get(k)));

      expect(values.join('|')).not.toContain(provider.lastCode);
    });

    it('enforces a resend cooldown', async () => {
      await service.issue(phone, 'sms');

      await expect(service.issue(phone, 'sms')).rejects.toThrow(BusinessRuleViolationError);
      expect(provider.sent).toHaveLength(1);
    });
  });

  describe('verify', () => {
    it('accepts the correct code', async () => {
      await service.issue(phone, 'sms');

      await expect(service.verify(phone, provider.lastCode)).resolves.toBeUndefined();
    });

    it('rejects an incorrect code', async () => {
      await service.issue(phone, 'sms');

      await expect(service.verify(phone, '000000')).rejects.toThrow(BusinessRuleViolationError);
    });

    it('rejects when no code was ever issued', async () => {
      await expect(service.verify(phone, '123456')).rejects.toThrow(BusinessRuleViolationError);
    });

    it('rejects the static 123456 that the old implementation always accepted', async () => {
      await service.issue(phone, 'sms');
      // Guards against a regression to the pre-Phase-2 `|| '123456'` fallback.
      if (provider.lastCode !== '123456') {
        await expect(service.verify(phone, '123456')).rejects.toThrow(BusinessRuleViolationError);
      }
    });

    it('does not accept a code issued for a different identifier', async () => {
      await service.issue(phone, 'sms');
      const code = provider.lastCode;

      await service.issue('+919999999999', 'sms');

      await expect(service.verify('+919999999999', code)).rejects.toThrow(
        BusinessRuleViolationError,
      );
    });

    it('locks out after the attempt limit', async () => {
      await service.issue(phone, 'sms');
      const good = provider.lastCode;

      for (let i = 0; i < CONFIG.OTP_MAX_ATTEMPTS - 1; i += 1) {
        await expect(service.verify(phone, '000000')).rejects.toThrow();
      }

      // Even the correct code fails once the code has been burned.
      await expect(service.verify(phone, good)).rejects.toThrow(BusinessRuleViolationError);
    });

    it('leaves the code usable so a second factor can still be supplied', async () => {
      await service.issue(phone, 'sms');
      const code = provider.lastCode;

      await service.verify(phone, code);

      await expect(service.verify(phone, code)).resolves.toBeUndefined();
    });
  });

  describe('consume', () => {
    it('spends the code so it cannot be replayed', async () => {
      await service.issue(phone, 'sms');
      const code = provider.lastCode;

      await service.verify(phone, code);
      await service.consume(phone);

      await expect(service.verify(phone, code)).rejects.toThrow(BusinessRuleViolationError);
    });
  });
});
