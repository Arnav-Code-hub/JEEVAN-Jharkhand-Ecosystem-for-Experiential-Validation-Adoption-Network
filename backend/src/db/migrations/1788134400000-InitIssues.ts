import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema. Replaces the previous `synchronize: true` behaviour, which
 * auto-created the table (formerly `citizen_issues`) on every boot.
 *
 * Indexes cover the columns every current query filters or sorts on: the review
 * queue orders by (isEmergency, createdAt), and listing filters by status.
 */
export class InitIssues1788134400000 implements MigrationInterface {
  name = 'InitIssues1788134400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "public"."issues_category_enum" AS ENUM (
        'water', 'roads', 'electricity', 'sanitation',
        'education', 'healthcare', 'agriculture', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."issues_status_enum" AS ENUM (
        'submitted', 'under_review', 'verified', 'rejected', 'in_progress', 'resolved'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."issues_channel_enum" AS ENUM (
        'web', 'mobile', 'whatsapp', 'voice'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "issues" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title"           character varying NOT NULL,
        "description"     text NOT NULL,
        "category"        "public"."issues_category_enum" NOT NULL,
        "status"          "public"."issues_status_enum" NOT NULL DEFAULT 'submitted',
        "channel"         "public"."issues_channel_enum" NOT NULL DEFAULT 'web',
        "latitude"        numeric(10,7),
        "longitude"       numeric(10,7),
        "address"         character varying,
        "district"        character varying,
        "block"           character varying,
        "citizenName"     character varying NOT NULL,
        "citizenPhone"    character varying,
        "citizenEmail"    character varying,
        "imageUrls"       text array NOT NULL DEFAULT '{}',
        "voiceNoteUrl"    character varying,
        "urgencyScore"    real,
        "isEmergency"     boolean NOT NULL DEFAULT false,
        "aiSummary"       character varying,
        "reviewedBy"      character varying,
        "reviewedAt"      TIMESTAMP WITH TIME ZONE,
        "rejectionReason" character varying,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issues_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_issues_status" ON "issues" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_issues_district" ON "issues" ("district")`);
    await queryRunner.query(`CREATE INDEX "IDX_issues_created_at" ON "issues" ("createdAt")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_issues_review_queue" ON "issues" ("isEmergency", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_review_queue"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_district"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_status"`);
    await queryRunner.query(`DROP TABLE "issues"`);
    await queryRunner.query(`DROP TYPE "public"."issues_channel_enum"`);
    await queryRunner.query(`DROP TYPE "public"."issues_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."issues_category_enum"`);
  }
}
