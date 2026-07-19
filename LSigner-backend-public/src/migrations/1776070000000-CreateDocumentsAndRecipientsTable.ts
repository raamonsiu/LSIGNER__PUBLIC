import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentsAndRecipientsTable1776070000000 implements MigrationInterface {
  name = 'CreateDocumentsAndRecipientsTable1776070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Document-status enum ──
    await queryRunner.query(`
      CREATE TYPE "document_status_enum" AS ENUM ('DRAFT', 'SENT', 'SUPERSEDED', 'VOIDED')
    `);

    // ── Recipient-status enum ──
    await queryRunner.query(`
      CREATE TYPE "recipient_status_enum" AS ENUM ('PENDING', 'UPDATED')
    `);

    // ── Documents table ──
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id"                   uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id"             uuid                     NOT NULL,
        "title"                character varying(255)   NOT NULL,
        "description"          text,
        "file"                 bytea                    NOT NULL,
        "file_hash"            character varying(64)    NOT NULL,
        "original_filename"    character varying(255)   NOT NULL,
        "mime_type"            character varying(100)   NOT NULL,
        "file_size"            bigint                   NOT NULL,
        "status"               "document_status_enum"   NOT NULL DEFAULT 'DRAFT',
        "version"              integer                  NOT NULL DEFAULT 1,
        "parent_document_id"   uuid,
        "created_at"           TIMESTAMP                NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP                NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_owner"
          FOREIGN KEY ("owner_id")
          REFERENCES "users"("patient_id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_documents_parent"
          FOREIGN KEY ("parent_document_id")
          REFERENCES "documents"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_documents_owner_id" ON "documents" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_status" ON "documents" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_parent_document_id" ON "documents" ("parent_document_id")`,
    );

    // ── Document recipients table ──
    await queryRunner.query(`
      CREATE TABLE "document_recipients" (
        "id"               uuid                      NOT NULL DEFAULT uuid_generate_v4(),
        "document_id"      uuid                      NOT NULL,
        "user_id"          uuid,
        "recipient_email"  character varying(255)    NOT NULL,
        "recipient_name"   character varying(200),
        "status"           "recipient_status_enum"   NOT NULL DEFAULT 'PENDING',
        "sent_at"          TIMESTAMP WITH TIME ZONE  NOT NULL,
        "created_at"       TIMESTAMP                 NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP                 NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_recipients_doc_email"
          UNIQUE ("document_id", "recipient_email"),
        CONSTRAINT "FK_document_recipients_document"
          FOREIGN KEY ("document_id")
          REFERENCES "documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_document_recipients_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("patient_id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_recipients_document_id" ON "document_recipients" ("document_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_recipients_user_id" ON "document_recipients" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "document_recipients"`);
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TYPE "recipient_status_enum"`);
    await queryRunner.query(`DROP TYPE "document_status_enum"`);
  }
}
