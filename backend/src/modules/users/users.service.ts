import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BusinessRuleViolationError,
  ResourceNotFoundError,
  StateConflictError,
} from '../../shared/errors/domain.error';
import {
  PHONE_ROLES,
  Role,
  ROLES_REQUIRING_ORG_UNIT,
  ROLES_REQUIRING_TOTP,
} from '../../shared/rbac/role.enum';
import { User, UserStatus } from './entities/user.entity';

export interface CreateUserInput {
  role: Role;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  orgUnitId?: string | null;
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOneBy({ phone });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email: email.toLowerCase() });
  }

  /** Non-throwing variant, for callers that treat absence as a normal outcome. */
  findByIdOrNull(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new ResourceNotFoundError(`User ${id} not found`);
    return user;
  }

  /** Loads a user including the normally-hidden TOTP secret. */
  findByIdWithSecret(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.totpSecret')
      .where('u.id = :id', { id })
      .getOne();
  }

  async create(input: CreateUserInput): Promise<User> {
    this.assertIdentifierMatchesRole(input.role, input.phone, input.email);

    if (ROLES_REQUIRING_ORG_UNIT.includes(input.role) && !input.orgUnitId) {
      throw new BusinessRuleViolationError(`Role ${input.role} requires an org unit`);
    }

    const email = input.email?.toLowerCase() ?? null;

    if (input.phone && (await this.findByPhone(input.phone))) {
      throw new StateConflictError('An account already exists for this phone number');
    }
    if (email && (await this.findByEmail(email))) {
      throw new StateConflictError('An account already exists for this email address');
    }

    return this.repo.save(
      this.repo.create({
        role: input.role,
        phone: input.phone ?? null,
        email,
        fullName: input.fullName ?? null,
        orgUnitId: input.orgUnitId ?? null,
        // Industry accounts must be verified by an admin before they can be
        // matched to projects (parameter.md §2).
        status: input.status ?? this.defaultStatusFor(input.role),
      }),
    );
  }

  /**
   * A user may hold a session only when active, and government roles only once
   * TOTP is enrolled (parameter.md §2).
   */
  assertCanAuthenticate(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new BusinessRuleViolationError('This account is suspended.');
    }
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new BusinessRuleViolationError(
        'This account is awaiting administrator verification before it can be used.',
      );
    }
  }

  requiresTotp(user: User): boolean {
    return ROLES_REQUIRING_TOTP.includes(user.role);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findById(id);
    if (user.status === UserStatus.ACTIVE) {
      throw new StateConflictError('Account is already active');
    }
    user.status = UserStatus.ACTIVE;
    return this.repo.save(user);
  }

  async suspend(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.SUSPENDED;
    return this.repo.save(user);
  }

  findPendingVerification(): Promise<User[]> {
    return this.repo.find({
      where: { status: UserStatus.PENDING_VERIFICATION },
      order: { createdAt: 'ASC' },
    });
  }

  async setTotpSecret(id: string, secret: string): Promise<void> {
    await this.repo.update({ id }, { totpSecret: secret, totpEnabled: false });
  }

  async enableTotp(id: string): Promise<void> {
    await this.repo.update({ id }, { totpEnabled: true });
  }

  async recordLogin(id: string): Promise<void> {
    await this.repo.update({ id }, { lastLoginAt: new Date() });
  }

  private defaultStatusFor(role: Role): UserStatus {
    return role === Role.INDUSTRY ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE;
  }

  private assertIdentifierMatchesRole(
    role: Role,
    phone?: string | null,
    email?: string | null,
  ): void {
    if (PHONE_ROLES.includes(role)) {
      if (!phone)
        throw new BusinessRuleViolationError('Citizens must register with a phone number');
      if (email) throw new BusinessRuleViolationError('Citizens do not use email addresses');
      return;
    }

    if (!email) throw new BusinessRuleViolationError(`Role ${role} must register with an email`);
  }
}
