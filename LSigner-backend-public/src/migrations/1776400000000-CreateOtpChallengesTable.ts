import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpChallengesTable1776400000000 implements MigrationInterface {
  name = 'CreateOtpChallengesTable1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "otp_action_type_enum" AS ENUM ('SIGN', 'REJECT', 'REVOKE')
    `);

    await queryRunner.query(`
      CREATE TYPE "otp_resource_type_enum" AS ENUM ('DOCUMENT')
    `);

    await queryRunner.query(`
      CREATE TYPE "otp_challenge_status_enum" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'LOCKED', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "otp_challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "action_type" "otp_action_type_enum" NOT NULL,
        "resource_type" "otp_resource_type_enum" NOT NULL,
        "resource_id" character varying NOT NULL,
        "otp_hash" character varying(64) NOT NULL,
        "otp_salt" character varying(32) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL,
        "resend_count" integer NOT NULL DEFAULT 0,
        "max_resends" integer NOT NULL,
        "resend_available_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "locked_until" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "status" "otp_challenge_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_challenges" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_otp_challenges_user_id" ON "otp_challenges" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_otp_challenges_resource_id" ON "otp_challenges" ("resource_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_otp_challenges_status" ON "otp_challenges" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_otp_challenges_scope" ON "otp_challenges" ("user_id", "action_type", "resource_type", "resource_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "otp_challenges"`);
    await queryRunner.query(`DROP TYPE "otp_challenge_status_enum"`);
    await queryRunner.query(`DROP TYPE "otp_resource_type_enum"`);
    await queryRunner.query(`DROP TYPE "otp_action_type_enum"`);
  }
}
