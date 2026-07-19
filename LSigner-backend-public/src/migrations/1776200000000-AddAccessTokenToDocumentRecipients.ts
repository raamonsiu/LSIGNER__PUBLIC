import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccessTokenToDocumentRecipients1776200000000 implements MigrationInterface {
  name = 'AddAccessTokenToDocumentRecipients1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document_recipients"
        ADD COLUMN "access_token" varchar(64) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_document_recipients_access_token"
        ON "document_recipients" ("access_token")
        WHERE "access_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_document_recipients_access_token"`,
    );
    await queryRunner.query(`
      ALTER TABLE "document_recipients" DROP COLUMN "access_token"
    `);
  }
}
