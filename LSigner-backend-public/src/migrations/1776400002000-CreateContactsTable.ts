import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactsTable1776400002000 implements MigrationInterface {
  name = 'CreateContactsTable1776400002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id"               uuid                    NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id"         uuid                    NOT NULL,
        "contact_user_id"  uuid,
        "contact_email"    character varying(255)  NOT NULL,
        "contact_name"     character varying(200),
        "contact_phone"    character varying(30),
        "created_at"       TIMESTAMP               NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP               NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contacts_owner_email"
          UNIQUE ("owner_id", "contact_email"),
        CONSTRAINT "FK_contacts_owner"
          FOREIGN KEY ("owner_id")
          REFERENCES "users"("patient_id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_contacts_contact_user"
          FOREIGN KEY ("contact_user_id")
          REFERENCES "users"("patient_id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_contacts_owner_id" ON "contacts" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contacts_contact_user_id" ON "contacts" ("contact_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_contacts_contact_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_contacts_owner_id"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
  }
}
