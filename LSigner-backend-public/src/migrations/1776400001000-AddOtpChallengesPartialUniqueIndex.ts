import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpChallengesPartialUniqueIndex1776400001000 implements MigrationInterface {
  name = 'AddOtpChallengesPartialUniqueIndex1776400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_otp_challenges_scope_active" ON "otp_challenges" ("user_id", "action_type", "resource_type", "resource_id") WHERE "status" = 'ACTIVE';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_otp_challenges_scope_active";`);
  }
}
