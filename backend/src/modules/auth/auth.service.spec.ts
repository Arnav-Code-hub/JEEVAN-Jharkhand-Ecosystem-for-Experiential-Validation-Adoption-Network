import { JwtService } from '@nestjs/jwt';
import { BusinessRuleViolationError } from '../../shared/errors/domain.error';
import { Role } from '../../shared/rbac/role.enum';
import { User, UserStatus } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

type Stub<T> = { [K in keyof T]: jest.Mock };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    role: Role.CITIZEN,
    status: UserStatus.ACTIVE,
    phone: '+919876543210',
    email: null,
    fullName: null,
    orgUnitId: null,
    totpEnabled: false,
    totpSecret: null,
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  let users: Stub<Record<string, unknown>>;
  let heiDomains: Stub<Record<string, unknown>>;
  let otp: Stub<Record<string, unknown>>;
  let tokens: Stub<Record<string, unknown>>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByPhone: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findByIdWithSecret: jest.fn(),
      create: jest.fn(),
      assertCanAuthenticate: jest.fn(),
      requiresTotp: jest.fn().mockReturnValue(false),
      recordLogin: jest.fn().mockResolvedValue(undefined),
      setTotpSecret: jest.fn().mockResolvedValue(undefined),
      enableTotp: jest.fn().mockResolvedValue(undefined),
    };
    heiDomains = { findForEmail: jest.fn().mockResolvedValue(null) };
    otp = {
      issue: jest.fn().mockResolvedValue({ expiresInSeconds: 300 }),
      verify: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
    };
    tokens = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', expiresIn: 900 }),
    };

    service = new AuthService(
      users as never,
      heiDomains as never,
      otp as never,
      tokens as never,
      new JwtService({ secret: 'y'.repeat(48) }),
    );
  });

  describe('resolveIdentifier', () => {
    it('normalises a bare Indian mobile number to E.164', () => {
      expect(service.resolveIdentifier('9876543210')).toEqual({
        normalised: '+919876543210',
        channel: 'sms',
      });
    });

    it('keeps an already-E.164 number stable', () => {
      expect(service.resolveIdentifier('+919876543210').normalised).toBe('+919876543210');
    });

    it('lowercases an email and routes it to the email channel', () => {
      expect(service.resolveIdentifier('  Student@BITMesra.ac.in ')).toEqual({
        normalised: 'student@bitmesra.ac.in',
        channel: 'email',
      });
    });

    it('rejects a malformed identifier', () => {
      expect(() => service.resolveIdentifier('12')).toThrow(BusinessRuleViolationError);
    });
  });

  describe('verifyOtp provisioning', () => {
    it('creates a citizen for an unseen phone number', async () => {
      users.create.mockResolvedValue(makeUser());

      await service.verifyOtp('9876543210', '111111');

      expect(users.create).toHaveBeenCalledWith({
        role: Role.CITIZEN,
        phone: '+919876543210',
      });
    });

    it('creates a student for an allowlisted institutional email', async () => {
      heiDomains.findForEmail.mockResolvedValue({ orgUnitId: 'org-bit' });
      users.create.mockResolvedValue(
        makeUser({ role: Role.STUDENT, phone: null, email: 'a@bitmesra.ac.in' }),
      );

      await service.verifyOtp('a@bitmesra.ac.in', '111111');

      expect(users.create).toHaveBeenCalledWith({
        role: Role.STUDENT,
        email: 'a@bitmesra.ac.in',
        orgUnitId: 'org-bit',
      });
    });

    it('creates a pending industry account for a non-allowlisted email', async () => {
      users.create.mockResolvedValue(
        makeUser({ role: Role.INDUSTRY, phone: null, email: 'ceo@acme.com' }),
      );

      await service.verifyOtp('ceo@acme.com', '111111');

      expect(users.create).toHaveBeenCalledWith({
        role: Role.INDUSTRY,
        email: 'ceo@acme.com',
      });
    });

    it('spends the OTP once a session is issued', async () => {
      users.create.mockResolvedValue(makeUser());

      const result = await service.verifyOtp('9876543210', '111111');

      expect(result.status).toBe('authenticated');
      expect(otp.consume).toHaveBeenCalledWith('+919876543210');
    });

    it('returns no PII in the authenticated payload', async () => {
      users.create.mockResolvedValue(makeUser());

      const result = await service.verifyOtp('9876543210', '111111');
      if (result.status !== 'authenticated') throw new Error('expected authentication');

      expect(result.user).not.toHaveProperty('phone');
      expect(result.user).not.toHaveProperty('email');
      expect(result.user).not.toHaveProperty('totpSecret');
    });
  });

  describe('two-factor flow for elevated roles', () => {
    const officer = makeUser({
      role: Role.GOVT_OFFICER,
      phone: null,
      email: 'officer@jh.gov.in',
      orgUnitId: 'ranchi',
    });

    beforeEach(() => {
      users.requiresTotp.mockReturnValue(true);
      users.findByEmail.mockResolvedValue(officer);
    });

    it('forces enrolment on first sign-in and issues no session', async () => {
      const result = await service.verifyOtp('officer@jh.gov.in', '111111');

      expect(result.status).toBe('totp_enrolment_required');
      expect(tokens.issuePair).not.toHaveBeenCalled();
      expect(users.setTotpSecret).toHaveBeenCalled();
    });

    it('asks for a TOTP code when already enrolled', async () => {
      users.findByEmail.mockResolvedValue({ ...officer, totpEnabled: true });

      const result = await service.verifyOtp('officer@jh.gov.in', '111111');

      expect(result.status).toBe('totp_required');
      expect(tokens.issuePair).not.toHaveBeenCalled();
    });

    it('leaves the OTP unspent while a second factor is outstanding', async () => {
      users.findByEmail.mockResolvedValue({ ...officer, totpEnabled: true });

      await service.verifyOtp('officer@jh.gov.in', '111111');

      // Otherwise the user could never complete sign-in: their OTP would be
      // gone before they supplied the TOTP code.
      expect(otp.consume).not.toHaveBeenCalled();
    });
  });

  it('refuses a suspended or unverified account', async () => {
    users.findByPhone.mockResolvedValue(makeUser({ status: UserStatus.SUSPENDED }));
    users.assertCanAuthenticate.mockImplementation(() => {
      throw new BusinessRuleViolationError('This account is suspended.');
    });

    await expect(service.verifyOtp('9876543210', '111111')).rejects.toThrow(
      BusinessRuleViolationError,
    );
    expect(tokens.issuePair).not.toHaveBeenCalled();
  });
});
