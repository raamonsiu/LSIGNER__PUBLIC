import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1775216194057 implements MigrationInterface {
  name = 'CreateUsersTable1775216194057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("patient_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "last_name" character varying(200) NOT NULL, "country" character varying(100) NOT NULL, "national_id" character varying(50), "passport" character varying(50), "email" character varying NOT NULL, "phone_number" character varying(30) NOT NULL, "password" character varying NOT NULL, "salt" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_232b9597ff9a89b2c2fc5d1b5e5" UNIQUE ("national_id"), CONSTRAINT "UQ_3fccdcd504a8b1bb16ed6c7335a" UNIQUE ("passport"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_17d1817f241f10a3dbafb169fd2" UNIQUE ("phone_number"), CONSTRAINT "PK_825cacf21791a38ce4bfc6a7d65" PRIMARY KEY ("patient_id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
