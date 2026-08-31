import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identity, organisational hierarchy, and the audit trail (Phase 2).
 *
 * Also enables `pgvector` up front (ADR-0002) so the extension exists long
 * before the competency matching in Phase 6 needs it — enabling an extension
 * requires privileges that may not be available later.
 */
export class InitIdentity1788220800000 implements MigrationInterface {
  name = 'InitIdentity1788220800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    await queryRunner.query(`
      CREATE TYPE "public"."org_units_tier_enum" AS ENUM (
        'state', 'district', 'block', 'panchayat', 'hei'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM (
        'citizen', 'student', 'faculty', 'industry', 'govt_officer', 'govt_state_admin'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."users_status_enum" AS ENUM (
        'pending_verification', 'active', 'suspended'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."audit_log_actorrole_enum" AS ENUM (
        'citizen', 'student', 'faculty', 'industry', 'govt_officer', 'govt_state_admin'
      )
    `);

    // ---- org_units --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "org_units" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code"      character varying(120) NOT NULL,
        "name"      character varying(160) NOT NULL,
        "tier"      "public"."org_units_tier_enum" NOT NULL,
        "parentId"  uuid,
        "path"      character varying(512) NOT NULL,
        "isActive"  boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_units_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_org_units_code" UNIQUE ("code"),
        CONSTRAINT "FK_org_units_parent" FOREIGN KEY ("parentId")
          REFERENCES "org_units"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_org_units_tier" ON "org_units" ("tier")`);
    await queryRunner.query(`CREATE INDEX "IDX_org_units_parent" ON "org_units" ("parentId")`);
    // Supports the subtree prefix match used for org scoping (ADR-0015).
    await queryRunner.query(
      `CREATE INDEX "IDX_org_units_path" ON "org_units" ("path" varchar_pattern_ops)`,
    );

    // ---- users ------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role"        "public"."users_role_enum" NOT NULL,
        "status"      "public"."users_status_enum" NOT NULL DEFAULT 'active',
        "phone"       character varying(20),
        "email"       character varying(255),
        "fullName"    character varying(160),
        "orgUnitId"   uuid,
        "totpSecret"  character varying(255),
        "totpEnabled" boolean NOT NULL DEFAULT false,
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_org_unit" FOREIGN KEY ("orgUnitId")
          REFERENCES "org_units"("id") ON DELETE RESTRICT,
        -- Citizens authenticate by phone, everyone else by email (parameter.md §2).
        CONSTRAINT "CHK_users_identifier" CHECK (
          ("role" = 'citizen' AND "phone" IS NOT NULL AND "email" IS NULL)
          OR ("role" <> 'citizen' AND "email" IS NOT NULL)
        )
      )
    `);
    // Partial unique indexes: the database, not the service, guarantees one
    // account per phone and per email.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_org_unit" ON "users" ("orgUnitId")`);

    // ---- hei_domains ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "hei_domains" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "domain"          character varying(255) NOT NULL,
        "institutionName" character varying(200) NOT NULL,
        "orgUnitId"       uuid,
        "isActive"        boolean NOT NULL DEFAULT true,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hei_domains_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hei_domains_domain" UNIQUE ("domain"),
        CONSTRAINT "FK_hei_domains_org_unit" FOREIGN KEY ("orgUnitId")
          REFERENCES "org_units"("id") ON DELETE RESTRICT
      )
    `);

    // ---- audit_log --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorId"         uuid,
        "actorRole"       "public"."audit_log_actorrole_enum",
        "actorOrgUnitId"  uuid,
        "action"          character varying(120) NOT NULL,
        "resourceType"    character varying(60),
        "resourceId"      character varying(120),
        "success"         boolean NOT NULL DEFAULT true,
        "requestId"       character varying(64),
        "metadata"        jsonb,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_actor" ON "audit_log" ("actorId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_org" ON "audit_log" ("actorOrgUnitId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_action" ON "audit_log" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_created" ON "audit_log" ("createdAt")`);

    // ---- issues: link the reporter ---------------------------------------
    await queryRunner.query(`ALTER TABLE "issues" ADD "reportedByUserId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "issues" ADD CONSTRAINT "FK_issues_reported_by"
        FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_issues_reported_by" ON "issues" ("reportedByUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_reported_by"`);
    await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_issues_reported_by"`);
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "reportedByUserId"`);

    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TABLE "hei_domains"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "org_units"`);

    await queryRunner.query(`DROP TYPE "public"."audit_log_actorrole_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."org_units_tier_enum"`);
    // The vector extension is left in place: other schemas may rely on it, and
    // dropping it would cascade to any column using the type.
  }
}
