import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAccessTokenWithPublicLinksAndSessions1776500000000 implements MigrationInterface {
  name = 'ReplaceAccessTokenWithPublicLinksAndSessions1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_recipients" ADD COLUMN "public_link_id" varchar(64) NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_recipients_public_link_id" ON "document_recipients" ("public_link_id") WHERE "public_link_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "public_link_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_id" uuid NOT NULL,
        "session_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "ip" character varying(100),
        "user_agent" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_public_link_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_public_link_sessions_session_hash" UNIQUE ("session_hash"),
        CONSTRAINT "FK_public_link_sessions_recipient" FOREIGN KEY ("recipient_id") REFERENCES "document_recipients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_public_link_sessions_recipient_id" ON "public_link_sessions" ("recipient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_public_link_sessions_expires_at" ON "public_link_sessions" ("expires_at")`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_document_recipients_access_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_recipients" DROP COLUMN "access_token"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_recipients" ADD COLUMN "access_token" varchar(64) NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_document_recipients_access_token" ON "document_recipients" ("access_token") WHERE "access_token" IS NOT NULL`,
    );

    await queryRunner.query(`DROP INDEX "IDX_public_link_sessions_expires_at"`);
    await queryRunner.query(
      `DROP INDEX "IDX_public_link_sessions_recipient_id"`,
    );
    await queryRunner.query(`DROP TABLE "public_link_sessions"`);

    await queryRunner.query(
      `DROP INDEX "IDX_document_recipients_public_link_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_recipients" DROP COLUMN "public_link_id"`,
    );
  }
}
