import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentSigningTracking1776300000000 implements MigrationInterface {
  name = 'AddDocumentSigningTracking1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "recipient_signing_status_enum" AS ENUM ('PENDING', 'SIGNED', 'REJECTED', 'REVOKED')
    `);

    await queryRunner.query(`
      ALTER TABLE "document_recipients"
        ADD COLUMN "first_accessed_at" TIMESTAMP WITH TIME ZONE NULL,
        ADD COLUMN "last_accessed_at" TIMESTAMP WITH TIME ZONE NULL,
        ADD COLUMN "signing_status" "recipient_signing_status_enum" NOT NULL DEFAULT 'PENDING',
        ADD COLUMN "signed_at" TIMESTAMP WITH TIME ZONE NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_document_recipients_signing_status"
        ON "document_recipients" ("signing_status")
    `);

    await queryRunner.query(`
      CREATE TYPE "document_signing_event_action_enum" AS ENUM ('ACCESS_OPENED', 'SIGNED', 'REJECTED', 'REVOKED')
    `);

    await queryRunner.query(`
      CREATE TABLE "document_signing_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "recipient_id" uuid NOT NULL,
        "action" "document_signing_event_action_enum" NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_signing_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_signing_events_document"
          FOREIGN KEY ("document_id")
          REFERENCES "documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_document_signing_events_recipient"
          FOREIGN KEY ("recipient_id")
          REFERENCES "document_recipients"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_signing_events_document_id" ON "document_signing_events" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_signing_events_recipient_id" ON "document_signing_events" ("recipient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_signing_events_occurred_at" ON "document_signing_events" ("occurred_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "document_signed_artifacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "recipient_id" uuid NOT NULL,
        "file" bytea NOT NULL,
        "file_hash" character varying(64) NOT NULL,
        "signature" text NOT NULL,
        "signature_algorithm" character varying(50) NOT NULL,
        "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_signed_artifacts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_signed_artifacts_doc_recipient" UNIQUE ("document_id", "recipient_id"),
        CONSTRAINT "FK_document_signed_artifacts_document"
          FOREIGN KEY ("document_id")
          REFERENCES "documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_document_signed_artifacts_recipient"
          FOREIGN KEY ("recipient_id")
          REFERENCES "document_recipients"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_signed_artifacts_document_id" ON "document_signed_artifacts" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_signed_artifacts_recipient_id" ON "document_signed_artifacts" ("recipient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "document_signed_artifacts"`);
    await queryRunner.query(`DROP TABLE "document_signing_events"`);
    await queryRunner.query(
      `DROP INDEX "IDX_document_recipients_signing_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "document_recipients"
        DROP COLUMN "signed_at",
        DROP COLUMN "signing_status",
        DROP COLUMN "last_accessed_at",
        DROP COLUMN "first_accessed_at"
    `);

    await queryRunner.query(`DROP TYPE "document_signing_event_action_enum"`);
    await queryRunner.query(`DROP TYPE "recipient_signing_status_enum"`);
  }
}
