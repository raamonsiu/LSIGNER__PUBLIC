import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEd25519SigningColumns1776600000000 implements MigrationInterface {
  name = 'AddEd25519SigningColumns1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ADD COLUMN "key_fingerprint" character varying(64),
        ADD COLUMN "key_version" integer DEFAULT 1,
        ADD COLUMN "previous_artifact_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "document_signed_artifacts"
      SET "key_fingerprint" = '0000000000000000000000000000000000000000000000000000000000000000',
          "key_version" = 0
      WHERE "key_fingerprint" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ALTER COLUMN "key_fingerprint" SET NOT NULL,
        ALTER COLUMN "key_version" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ALTER COLUMN "signature_algorithm" SET DEFAULT 'Ed25519'
    `);

    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ADD CONSTRAINT "FK_previous_artifact"
        FOREIGN KEY ("previous_artifact_id")
        REFERENCES "document_signed_artifacts"("id")
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        DROP CONSTRAINT "FK_previous_artifact"
    `);

    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ALTER COLUMN "signature_algorithm" SET DEFAULT 'HMAC-SHA256'
    `);

    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        DROP COLUMN "previous_artifact_id",
        DROP COLUMN "key_version",
        DROP COLUMN "key_fingerprint"
    `);
  }
}
