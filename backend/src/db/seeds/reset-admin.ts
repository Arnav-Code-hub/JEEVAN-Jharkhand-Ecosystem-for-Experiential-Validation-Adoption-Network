import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import Redis from 'ioredis';
import dataSource from '../data-source';
import { OrgUnit } from '../../modules/users/entities/org-unit.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { Role } from '../../shared/rbac/role.enum';

loadDotenv();

/**
 * Deletes and recreates a government administrator so a fresh TOTP secret is
 * generated on next sign-in.
 *
 * Use this whenever an enrolment secret may have been exposed — a shared
 * terminal, a screen recording, a pasted log. The account is recreated with
 * `totpSecret` null and `totpEnabled` false, so the next OTP sign-in restarts
 * enrolment from scratch.
 *
 *   SEED_ADMIN_EMAIL=you@example.com npm run db:reset-admin
 *   npm run db:reset-admin -- you@example.com
 */
async function run(): Promise<void> {
  const email = (process.argv[2] ?? process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();

  if (!email) {
    console.error(
      'No email given.\n' +
        '  Usage: npm run db:reset-admin -- admin@example.com\n' +
        '     or: set SEED_ADMIN_EMAIL in .env',
    );
    process.exit(1);
  }

  const ds = await dataSource.initialize();
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  });

  try {
    const users = ds.getRepository(User);
    const orgUnits = ds.getRepository(OrgUnit);

    const existing = await users.findOneBy({ email });

    if (existing) {
      if (existing.role !== Role.GOVT_STATE_ADMIN && existing.role !== Role.GOVT_OFFICER) {
        // Refuse to touch a citizen or industry account by accident.
        throw new Error(`${email} is a ${existing.role} account, not a government one. Aborting.`);
      }

      // Kill live sessions first: deleting the row alone would leave refresh
      // tokens in Redis pointing at a user id that no longer exists.
      await redis.connect().catch(() => undefined);
      const families = await redis.smembers(`rt:user:${existing.id}`);
      for (const familyId of families) {
        const hashes = await redis.smembers(`rt:family:${familyId}`);
        await Promise.all(hashes.map((h) => redis.del(`rt:active:${h}`)));
        await redis.del(`rt:family:${familyId}`);
      }
      await redis.del(`rt:user:${existing.id}`);

      await users.delete({ id: existing.id });
      console.log(`Deleted ${email} (${existing.role}) and revoked ${families.length} session(s).`);
    } else {
      console.log(`No existing account for ${email}.`);
    }

    const state = await orgUnits.findOneBy({ code: 'jh' });
    if (!state) {
      throw new Error('State org unit "jh" not found. Run `npm run seed` first.');
    }

    const recreated = await users.save(
      users.create({
        role: Role.GOVT_STATE_ADMIN,
        email,
        fullName: 'Bootstrap State Administrator',
        orgUnitId: state.id,
        status: UserStatus.ACTIVE,
      }),
    );

    console.log(`Recreated ${email} as govt_state_admin (id ${recreated.id}).`);
    console.log('TOTP is not enrolled — the next OTP sign-in will issue a new secret.');
  } finally {
    await redis.quit().catch(() => undefined);
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('Reset failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
