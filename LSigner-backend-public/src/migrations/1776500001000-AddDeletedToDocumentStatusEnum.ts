import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedToDocumentStatusEnum1776500001000 implements MigrationInterface {
  name = 'AddDeletedToDocumentStatusEnum1776500001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "document_status_enum" ADD VALUE 'DELETED'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing a value from an enum.
    // To roll back, you would need to create a new type without 'DELETED',
    // alter the column to use the new type, and drop the old type.
    // This is intentionally left as a no-op to avoid data loss.
  }
}
