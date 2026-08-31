import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import dataSource from '../data-source';
import { OrgUnit, OrgUnitTier } from '../../modules/users/entities/org-unit.entity';
import { HeiDomain } from '../../modules/users/entities/hei-domain.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { Role } from '../../shared/rbac/role.enum';

interface SeedOrgUnit {
  code: string;
  name: string;
  tier: OrgUnitTier;
  parentCode: string | null;
}

interface SeedHeiDomain {
  domain: string;
  institutionName: string;
  orgUnitCode: string | null;
}

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as T;
}

/**
 * Idempotent, keyed on the stable `code` / `domain` columns.
 *
 * Re-running is safe and is the intended way to correct the block list, which
 * is flagged as unverified in the data file (ADR-0010): fix the JSON, re-run,
 * and existing rows are updated in place rather than duplicated.
 */
async function seedOrgUnits(ds: DataSource): Promise<Map<string, string>> {
  const repo = ds.getRepository(OrgUnit);
  const { orgUnits } = loadJson<{ orgUnits: SeedOrgUnit[] }>('jharkhand-org-units.json');

  const idByCode = new Map<string, string>();
  const pathByCode = new Map<string, string>();

  // Parents before children, so a parent's path always exists when needed.
  const tierOrder: OrgUnitTier[] = [
    OrgUnitTier.STATE,
    OrgUnitTier.DISTRICT,
    OrgUnitTier.BLOCK,
    OrgUnitTier.PANCHAYAT,
    OrgUnitTier.HEI,
  ];
  const ordered = [...orgUnits].sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier),
  );

  let created = 0;
  let updated = 0;

  for (const unit of ordered) {
    const parentPath = unit.parentCode ? pathByCode.get(unit.parentCode) : undefined;
    if (unit.parentCode && !parentPath) {
      throw new Error(`Seed error: ${unit.code} references unknown parent ${unit.parentCode}`);
    }

    const path = parentPath ? `${parentPath}/${unit.code}` : unit.code;
    const parentId = unit.parentCode ? (idByCode.get(unit.parentCode) ?? null) : null;

    const existing = await repo.findOneBy({ code: unit.code });
    if (existing) {
      existing.name = unit.name;
      existing.tier = unit.tier;
      existing.parentId = parentId;
      existing.path = path;
      await repo.save(existing);
      idByCode.set(unit.code, existing.id);
      updated += 1;
    } else {
      const saved = await repo.save(
        repo.create({ code: unit.code, name: unit.name, tier: unit.tier, parentId, path }),
      );
      idByCode.set(unit.code, saved.id);
      created += 1;
    }

    pathByCode.set(unit.code, path);
  }

  console.log(`org_units:   ${created} created, ${updated} updated (${ordered.length} total)`);
  return idByCode;
}

async function seedHeiDomains(ds: DataSource, idByCode: Map<string, string>): Promise<void> {
  const repo = ds.getRepository(HeiDomain);
  const { heiDomains } = loadJson<{ heiDomains: SeedHeiDomain[] }>('hei-domains.json');

  let created = 0;
  let updated = 0;

  for (const entry of heiDomains) {
    const orgUnitId = entry.orgUnitCode ? (idByCode.get(entry.orgUnitCode) ?? null) : null;
    if (entry.orgUnitCode && !orgUnitId) {
      throw new Error(
        `Seed error: ${entry.domain} references unknown org unit ${entry.orgUnitCode}`,
      );
    }

    const existing = await repo.findOneBy({ domain: entry.domain });
    if (existing) {
      existing.institutionName = entry.institutionName;
      existing.orgUnitId = orgUnitId;
      await repo.save(existing);
      updated += 1;
    } else {
      await repo.save(
        repo.create({
          domain: entry.domain,
          institutionName: entry.institutionName,
          orgUnitId,
        }),
      );
      created += 1;
    }
  }

  console.log(`hei_domains: ${created} created, ${updated} updated`);
}

/**
 * Bootstrap administrator.
 *
 * Government accounts are never self-registered (parameter.md §2), so without a
 * seeded one there is no way to reach any admin endpoint. Created only when
 * SEED_ADMIN_EMAIL is set, and only if absent — never overwritten.
 */
async function seedBootstrapAdmin(ds: DataSource, idByCode: Map<string, string>): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  if (!email) {
    console.log('bootstrap:  skipped (set SEED_ADMIN_EMAIL to create a state admin)');
    return;
  }

  const repo = ds.getRepository(User);
  if (await repo.findOneBy({ email })) {
    console.log('bootstrap:  state admin already exists');
    return;
  }

  await repo.save(
    repo.create({
      role: Role.GOVT_STATE_ADMIN,
      email,
      fullName: 'Bootstrap State Administrator',
      orgUnitId: idByCode.get('jh') ?? null,
      status: UserStatus.ACTIVE,
    }),
  );

  console.log(`bootstrap:  state admin created for ${email} (TOTP enrols on first sign-in)`);
}

async function run(): Promise<void> {
  const ds = await dataSource.initialize();
  try {
    const idByCode = await seedOrgUnits(ds);
    await seedHeiDomains(ds, idByCode);
    await seedBootstrapAdmin(ds, idByCode);
    console.log('Seed complete.');
  } finally {
    await ds.destroy();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
