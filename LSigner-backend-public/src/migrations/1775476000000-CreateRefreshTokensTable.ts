import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1775476000000 implements MigrationInterface {
  name = 'CreateRefreshTokensTable1775476000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid                     NOT NULL,
        "token_hash" character varying(64)    NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked"    boolean                  NOT NULL DEFAULT false,
        "created_at" TIMESTAMP                NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("patient_id")
          ON DELETE CASCADE
      )
    `);

    // Index on token_hash for O(1) lookups on refresh / logout
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    );

    // Index on user_id for efficient cascading queries
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
