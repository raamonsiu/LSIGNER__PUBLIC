import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanonicalPayloadToArtifacts1776600001000 implements MigrationInterface {
  name = 'AddCanonicalPayloadToArtifacts1776600001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ADD COLUMN "canonical_payload" text NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        DROP COLUMN "canonical_payload"
    `);
  }
}
