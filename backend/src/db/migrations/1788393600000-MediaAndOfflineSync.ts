import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Media evidence and offline-sync idempotency (Phase 3 completion).
 *
 * Replaces `issues.imageUrls` (a bare text array) with a real `media` table, so
 * each file can carry its own capture geotag — which `parameter.md` mandates for
 * every photo and video and a text array cannot express — and so G3 pilot
 * evidence in Phase 7 has somewhere to live.
 */
export class MediaAndOfflineSync1788393600000 implements MigrationInterface {
  name = 'MediaAndOfflineSync1788393600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."media_kind_enum" AS ENUM ('photo', 'video', 'audio', 'document')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."media_status_enum" AS ENUM ('pending', 'confirmed')
    `);

    await queryRunner.query(`
      CREATE TABLE "media" (
        "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storageKey"         character varying(512) NOT NULL,
        "kind"               "public"."media_kind_enum" NOT NULL,
        "status"             "public"."media_status_enum" NOT NULL DEFAULT 'pending',
        "mimeType"           character varying(120) NOT NULL,
        "sizeBytes"          bigint NOT NULL DEFAULT 0,
        "uploadedByUserId"   uuid NOT NULL,
        "issueId"            uuid,
        "projectId"          uuid,
        "latitude"           numeric(10,7),
        "longitude"          numeric(10,7),
        "capturedAt"         TIMESTAMP WITH TIME ZONE,
        "checksum"           character varying(128),
        "createdAt"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "confirmedAt"        TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_media_storage_key" UNIQUE ("storageKey"),
        CONSTRAINT "FK_media_uploader" FOREIGN KEY ("uploadedByUserId")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_media_issue" FOREIGN KEY ("issueId")
          REFERENCES "issues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_media_project" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_media_size" CHECK ("sizeBytes" >= 0),
        -- A photo or video is only evidence if we know where it was taken.
        CONSTRAINT "CHK_media_geotag" CHECK (
          "kind" NOT IN ('photo', 'video')
          OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_media_issue" ON "media" ("issueId")`);
    await queryRunner.query(`CREATE INDEX "IDX_media_project" ON "media" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_media_uploader" ON "media" ("uploadedByUserId")`);
    await queryRunner.query(`CREATE INDEX "IDX_media_status" ON "media" ("status")`);

    // ---- offline sync idempotency ----------------------------------------
    await queryRunner.query(`ALTER TABLE "issues" ADD "clientId" uuid`);
    // Partial unique index: the database, not the service, guarantees that a
    // retried offline submission cannot create a second issue.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_issues_client_id" ON "issues" ("clientId")
        WHERE "clientId" IS NOT NULL
    `);

    // ---- retire the legacy attachment columns ----------------------------
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "imageUrls"`);
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "voiceNoteUrl"`);

    // Supports the ADR-0006 corroboration query: category + recency, with the
    // haversine distance filter applied to the narrowed set.
    await queryRunner.query(`
      CREATE INDEX "IDX_issues_corroboration" ON "issues" ("category", "createdAt")
        WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_issues_corroboration"`);

    await queryRunner.query(`ALTER TABLE "issues" ADD "voiceNoteUrl" character varying`);
    await queryRunner.query(
      `ALTER TABLE "issues" ADD "imageUrls" text array NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(`DROP INDEX "public"."UQ_issues_client_id"`);
    await queryRunner.query(`ALTER TABLE "issues" DROP COLUMN "clientId"`);

    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP TYPE "public"."media_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."media_kind_enum"`);
  }
}
