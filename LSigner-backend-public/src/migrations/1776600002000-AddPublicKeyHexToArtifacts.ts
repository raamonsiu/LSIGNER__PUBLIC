import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicKeyHexToArtifacts1776600002000 implements MigrationInterface {
  name = 'AddPublicKeyHexToArtifacts1776600002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        ADD COLUMN "public_key_hex" character varying(64) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_signed_artifacts"
        DROP COLUMN "public_key_hex"
    `);
  }
}
