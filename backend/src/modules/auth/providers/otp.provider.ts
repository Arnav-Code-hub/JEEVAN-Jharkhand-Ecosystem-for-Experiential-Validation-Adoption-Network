import { Injectable, Logger } from '@nestjs/common';

export type OtpChannel = 'sms' | 'email';

/**
 * Delivery of one-time codes.
 *
 * Follows the mock-behind-a-real-interface rule in parameter.md §3/§4: the
 * production SMS or email provider swaps in behind this interface with no
 * structural change to callers.
 */
export interface OtpProvider {
  send(channel: OtpChannel, destination: string, code: string): Promise<void>;
}

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

/**
 * Development implementation. Logs the code at warn level so it can be read from
 * the console during local testing.
 *
 * It deliberately does NOT return the code to the caller — the pre-Phase-2
 * implementation put `mockOtp` in the HTTP response body, which is an
 * authentication bypass rather than a mock.
 */
@Injectable()
export class MockOtpProvider implements OtpProvider {
  private readonly logger = new Logger('MockOtpProvider');

  async send(channel: OtpChannel, destination: string, code: string): Promise<void> {
    this.logger.warn(
      `[DEV ONLY] OTP for ${this.mask(destination)} via ${channel}: ${code} ` +
        '— replace with a real provider before deploying.',
    );
  }

  /** Never log a full phone number or email, even in development (§8). */
  private mask(destination: string): string {
    if (destination.includes('@')) {
      const [local, domain] = destination.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    }
    return `${destination.slice(0, 3)}***${destination.slice(-2)}`;
  }
}
