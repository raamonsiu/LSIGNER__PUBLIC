import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumnsAndEnums1776700000000 implements MigrationInterface {
  name = 'AddSoftDeleteColumnsAndEnums1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make email nullable (drop unique constraint first, re-add later)
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "email" DROP NOT NULL,
        ALTER COLUMN "email" DROP DEFAULT
    `);

    // Make phone_number nullable
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "phone_number" DROP NOT NULL,
        ALTER COLUMN "phone_number" DROP DEFAULT
    `);

    // Add deleted_at column
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "deleted_at" TIMESTAMPTZ DEFAULT NULL
    `);

    // Add CANCELLED to document_status_enum
    await queryRunner.query(`
      ALTER TYPE "document_status_enum" ADD VALUE 'CANCELLED'
    `);

    // Add EXPIRED to recipient_signing_status_enum
    await queryRunner.query(`
      ALTER TYPE "recipient_signing_status_enum" ADD VALUE 'EXPIRED'
    `);

    // Add RECIPIENT_ACCOUNT_DELETED to document_signing_event_action_enum
    await queryRunner.query(`
      ALTER TYPE "document_signing_event_action_enum" ADD VALUE 'RECIPIENT_ACCOUNT_DELETED'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... DROP VALUE is not supported by PostgreSQL.
    // To roll back: create new type without the value, alter column,
    // drop old type. This is a no-op to avoid accidental data loss.
    // Column changes: restore NOT NULL on email/phone_number,
    // drop deleted_at column.
  }
}
