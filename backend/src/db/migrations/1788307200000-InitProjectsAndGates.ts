import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Project aggregate and the immutable gate decision trail (Phase 3).
 *
 * `projects` is separate from `issues` (ADR-0003) so several corroborating
 * reports can be merged into one demand profile — the flowchart's G1
 * "Return / Merge / Close" branch, which a single flat table cannot express.
 */
export class InitProjectsAndGates1788307200000 implements MigrationInterface {
  name = 'InitProjectsAndGates1788307200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."projects_state_enum" AS ENUM (
        'g1_passed', 'g2_passed', 'g3_passed', 'g4_passed',
        'deployed', 'deployed_verified', 'on_hold', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."gate_transitions_gate_enum" AS ENUM (
        'g1', 'g2', 'g3', 'g4', 'adoption_check_in'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."gate_transitions_outcome_enum" AS ENUM ('passed', 'failed')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."gate_transitions_fromstate_enum" AS ENUM (
        'g1_passed', 'g2_passed', 'g3_passed', 'g4_passed',
        'deployed', 'deployed_verified', 'on_hold', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."gate_transitions_tostate_enum" AS ENUM (
        'g1_passed', 'g2_passed', 'g3_passed', 'g4_passed',
        'deployed', 'deployed_verified', 'on_hold', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."gate_transitions_actorrole_enum" AS ENUM (
        'citizen', 'student', 'faculty', 'industry', 'govt_officer', 'govt_state_admin'
      )
    `);

    // ---- projects ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"                   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference"            character varying(40) NOT NULL,
        "title"                character varying(200) NOT NULL,
        "problemStatement"     text NOT NULL,
        "state"                "public"."projects_state_enum" NOT NULL DEFAULT 'g1_passed',
        "originIssueId"        uuid NOT NULL,
        "orgUnitId"            uuid,
        "bountyMultiplier"     integer NOT NULL DEFAULT 1,
        "impactPoints"         integer NOT NULL DEFAULT 0,
        "deployedAt"           TIMESTAMP WITH TIME ZONE,
        "adoptionCheckInDueAt" TIMESTAMP WITH TIME ZONE,
        "createdAt"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_projects_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_projects_origin_issue" FOREIGN KEY ("originIssueId")
          REFERENCES "issues"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_projects_org_unit" FOREIGN KEY ("orgUnitId")
          REFERENCES "org_units"("id") ON DELETE RESTRICT,
        -- Impact points attach to deployment, never to ideation (parameter.md §7).
        CONSTRAINT "CHK_projects_impact_points" CHECK ("impactPoints" >= 0),
        CONSTRAINT "CHK_projects_bounty" CHECK ("bountyMultiplier" >= 1)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_projects_state" ON "projects" ("state")`);
    // Scoped list queries filter on org unit then order by recency (ADR-0015).
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_org_created" ON "projects" ("orgUnitId", "createdAt")`,
    );

    // ---- project_issues ---------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "project_issues" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "issueId"   uuid NOT NULL,
        "isPrimary" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_issues_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_issues" UNIQUE ("projectId", "issueId"),
        CONSTRAINT "FK_project_issues_project" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_issues_issue" FOREIGN KEY ("issueId")
          REFERENCES "issues"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_issues_project" ON "project_issues" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_issues_issue" ON "project_issues" ("issueId")`,
    );
    // One issue may be the primary origin of at most one project.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_project_issues_primary" ON "project_issues" ("issueId")
        WHERE "isPrimary" = true
    `);

    // ---- gate_transitions -------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "gate_transitions" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId"      uuid NOT NULL,
        "gate"           "public"."gate_transitions_gate_enum" NOT NULL,
        "outcome"        "public"."gate_transitions_outcome_enum" NOT NULL,
        "fromState"      "public"."gate_transitions_fromstate_enum",
        "toState"        "public"."gate_transitions_tostate_enum" NOT NULL,
        "actorId"        uuid NOT NULL,
        "actorRole"      "public"."gate_transitions_actorrole_enum" NOT NULL,
        "actorOrgUnitId" uuid,
        "reason"         character varying(500),
        "evidence"       jsonb,
        "requestId"      character varying(64),
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gate_transitions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gate_transitions_project" FOREIGN KEY ("projectId")
          REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_gate_transitions_project" ON "gate_transitions" ("projectId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gate_transitions_gate" ON "gate_transitions" ("gate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gate_transitions_actor" ON "gate_transitions" ("actorId")`,
    );

    // The audit trail is append-only: a gate decision must never be edited or
    // erased. Enforced in the database so it holds regardless of application
    // bugs or direct SQL access.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "gate_transitions_append_only"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'gate_transitions is append-only; % is not permitted', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_gate_transitions_append_only"
        BEFORE UPDATE OR DELETE ON "gate_transitions"
        FOR EACH ROW EXECUTE FUNCTION "gate_transitions_append_only"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_gate_transitions_append_only" ON "gate_transitions"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS "gate_transitions_append_only"()`);

    await queryRunner.query(`DROP TABLE "gate_transitions"`);
    await queryRunner.query(`DROP TABLE "project_issues"`);
    await queryRunner.query(`DROP TABLE "projects"`);

    await queryRunner.query(`DROP TYPE "public"."gate_transitions_actorrole_enum"`);
    await queryRunner.query(`DROP TYPE "public"."gate_transitions_tostate_enum"`);
    await queryRunner.query(`DROP TYPE "public"."gate_transitions_fromstate_enum"`);
    await queryRunner.query(`DROP TYPE "public"."gate_transitions_outcome_enum"`);
    await queryRunner.query(`DROP TYPE "public"."gate_transitions_gate_enum"`);
    await queryRunner.query(`DROP TYPE "public"."projects_state_enum"`);
  }
}
