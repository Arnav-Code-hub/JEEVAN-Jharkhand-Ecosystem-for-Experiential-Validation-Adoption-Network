import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import parsePhoneNumber from 'libphonenumber-js';
import {
  BusinessRuleViolationError,
  ForbiddenActionError,
  ResourceNotFoundError,
} from '../../shared/errors/domain.error';
import { Role } from '../../shared/rbac/role.enum';
import { HeiDomainsService } from '../users/hei-domains.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { TokenPair, TokenService } from './token.service';
import { OtpChannel } from './providers/otp.provider';

/** Short-lived token that authorises exactly one action: completing enrolment. */
interface EnrolmentTokenPayload {
  sub: string;
  typ: 'totp_enrolment';
}

const ENROLMENT_TOKEN_TTL_SECONDS = 600;

export interface ResolvedIdentifier {
  normalised: string;
  channel: OtpChannel;
}

export type VerifyResult =
  | { status: 'authenticated'; tokens: TokenPair; user: PublicUser }
  | { status: 'totp_required' }
  | {
      status: 'totp_enrolment_required';
      enrolment: { secret: string; otpauthUrl: string; enrolmentToken: string };
    };

/** The only user shape ever returned over HTTP. Never carries the TOTP secret. */
export interface PublicUser {
  id: string;
  role: Role;
  status: string;
  fullName: string | null;
  orgUnitId: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly heiDomains: HeiDomainsService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Normalises a phone number or email and picks the delivery channel.
   *
   * Phone numbers are parsed against India so a citizen may type `9876543210`
   * without a country code, and are stored in E.164 so one person never ends up
   * with two accounts.
   */
  resolveIdentifier(raw: string): ResolvedIdentifier {
    const trimmed = raw.trim();

    if (trimmed.includes('@')) {
      return { normalised: trimmed.toLowerCase(), channel: 'email' };
    }

    const parsed = parsePhoneNumber(trimmed, 'IN');
    if (!parsed?.isValid()) {
      throw new BusinessRuleViolationError('Enter a valid phone number or email address.');
    }

    return { normalised: parsed.number, channel: 'sms' };
  }

  /**
   * Issues an OTP. Reports success whether or not an account exists — otherwise
   * this endpoint becomes an account-enumeration oracle.
   */
  async requestOtp(rawIdentifier: string): Promise<{ expiresInSeconds: number }> {
    const { normalised, channel } = this.resolveIdentifier(rawIdentifier);
    return this.otp.issue(normalised, channel);
  }

  /**
   * Verifies an OTP and, for a first-time identifier, provisions the account.
   *
   * The OTP is validated first but only spent once every factor has passed, so a
   * government user who still owes a TOTP code can retry without requesting a
   * new OTP.
   */
  async verifyOtp(rawIdentifier: string, code: string, totp?: string): Promise<VerifyResult> {
    const { normalised, channel } = this.resolveIdentifier(rawIdentifier);

    await this.otp.verify(normalised, code);

    const existing =
      channel === 'sms'
        ? await this.users.findByPhone(normalised)
        : await this.users.findByEmail(normalised);

    const user = existing ?? (await this.provision(normalised, channel));

    this.users.assertCanAuthenticate(user);

    if (this.users.requiresTotp(user)) {
      if (!user.totpEnabled) {
        // First sign-in for an elevated account. Force enrolment before any
        // session exists, and spend the OTP — the enrolment token now carries
        // the right to finish.
        await this.otp.consume(normalised);
        return { status: 'totp_enrolment_required', enrolment: await this.beginEnrolment(user) };
      }

      // Leave the OTP unspent so the client can retry with the second factor.
      if (!totp) return { status: 'totp_required' };

      await this.assertTotpValid(user.id, totp);
    }

    await this.otp.consume(normalised);
    await this.users.recordLogin(user.id);

    const tokens = await this.tokens.issuePair(user);
    return { status: 'authenticated', tokens, user: AuthService.toPublicUser(user) };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async currentUser(userId: string): Promise<PublicUser> {
    return AuthService.toPublicUser(await this.users.findById(userId));
  }

  /**
   * Completes TOTP enrolment and issues the first session.
   *
   * Authorised by the enrolment token rather than a bearer session, because the
   * account cannot hold a session until this succeeds.
   */
  async confirmTotp(
    enrolmentToken: string,
    code: string,
  ): Promise<{ tokens: TokenPair; user: PublicUser }> {
    let payload: EnrolmentTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<EnrolmentTokenPayload>(enrolmentToken);
    } catch {
      throw new ForbiddenActionError('Enrolment session expired. Sign in again to restart.');
    }

    if (payload.typ !== 'totp_enrolment') {
      throw new ForbiddenActionError('Invalid enrolment token.');
    }

    await this.assertTotpValid(payload.sub, code);
    await this.users.enableTotp(payload.sub);
    await this.users.recordLogin(payload.sub);

    const user = await this.users.findById(payload.sub);
    return { tokens: await this.tokens.issuePair(user), user: AuthService.toPublicUser(user) };
  }

  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      fullName: user.fullName,
      orgUnitId: user.orgUnitId,
    };
  }

  /**
   * Determines the role for a previously-unseen identifier.
   *
   * - phone                 → citizen
   * - allowlisted HEI email → student, attached to that institution's org unit
   * - any other email       → industry, pending administrator verification
   *
   * Government and faculty accounts are never created here; they are provisioned
   * by an administrator or a seed (parameter.md §2).
   */
  private async provision(identifier: string, channel: OtpChannel): Promise<User> {
    if (channel === 'sms') {
      return this.users.create({ role: Role.CITIZEN, phone: identifier });
    }

    const hei = await this.heiDomains.findForEmail(identifier);
    if (hei) {
      return this.users.create({
        role: Role.STUDENT,
        email: identifier,
        orgUnitId: hei.orgUnitId,
      });
    }

    return this.users.create({ role: Role.INDUSTRY, email: identifier });
  }

  private async beginEnrolment(
    user: User,
  ): Promise<{ secret: string; otpauthUrl: string; enrolmentToken: string }> {
    const secret = authenticator.generateSecret();
    await this.users.setTotpSecret(user.id, secret);

    const payload: EnrolmentTokenPayload = { sub: user.id, typ: 'totp_enrolment' };
    const enrolmentToken = await this.jwt.signAsync(payload, {
      expiresIn: ENROLMENT_TOKEN_TTL_SECONDS,
    });

    return {
      secret,
      otpauthUrl: authenticator.keyuri(user.email ?? user.id, 'JEEVAN', secret),
      enrolmentToken,
    };
  }

  private async assertTotpValid(userId: string, code: string): Promise<void> {
    const user = await this.users.findByIdWithSecret(userId);
    if (!user) throw new ResourceNotFoundError(`User ${userId} not found`);
    if (!user.totpSecret) {
      throw new BusinessRuleViolationError('No authenticator is enrolled for this account.');
    }
    if (!authenticator.check(code, user.totpSecret)) {
      throw new ForbiddenActionError('That authenticator code is not valid.');
    }
  }
}
