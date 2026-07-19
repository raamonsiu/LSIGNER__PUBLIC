import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentLocksTable1776100000000 implements MigrationInterface {
  name = 'CreateDocumentLocksTable1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Lock-type enum ──
    await queryRunner.query(`
      CREATE TYPE "lock_type_enum" AS ENUM ('PASSWORD')
    `);

    // ── Document locks table ──
    await queryRunner.query(`
      CREATE TABLE "document_locks" (
        "id"           uuid                 NOT NULL DEFAULT uuid_generate_v4(),
        "document_id"  uuid                 NOT NULL,
        "lock_type"    "lock_type_enum"     NOT NULL,
        "config"       jsonb                NOT NULL,
        "created_at"   TIMESTAMP            NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_locks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_locks_document"
          FOREIGN KEY ("document_id")
          REFERENCES "documents"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_locks_document_id" ON "document_locks" ("document_id")`,
    );

    // ── Document lock resolutions table ──
    await queryRunner.query(`
      CREATE TABLE "document_lock_resolutions" (
        "id"            uuid                NOT NULL DEFAULT uuid_generate_v4(),
        "lock_id"       uuid                NOT NULL,
        "recipient_id"  uuid                NOT NULL,
        "resolved_at"   TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at"    TIMESTAMP           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_lock_resolutions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_lock_resolutions_lock_recipient"
          UNIQUE ("lock_id", "recipient_id"),
        CONSTRAINT "FK_document_lock_resolutions_lock"
          FOREIGN KEY ("lock_id")
          REFERENCES "document_locks"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_document_lock_resolutions_recipient"
          FOREIGN KEY ("recipient_id")
          REFERENCES "document_recipients"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_lock_resolutions_lock_id" ON "document_lock_resolutions" ("lock_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_lock_resolutions_recipient_id" ON "document_lock_resolutions" ("recipient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "document_lock_resolutions"`);
    await queryRunner.query(`DROP TABLE "document_locks"`);
    await queryRunner.query(`DROP TYPE "lock_type_enum"`);
  }
}
