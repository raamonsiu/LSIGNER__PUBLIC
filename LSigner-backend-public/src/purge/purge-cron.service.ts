import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { PurgeService } from './purge.service';

/**
 * Wraps PurgeService in a daily cron job at 3:00 AM.
 *
 * The @Cron decorator requires @nestjs/schedule to be imported in
 * the module. All business logic lives in PurgeService so it can be
 * tested without the cron runtime.
 */
@Injectable()
export class PurgeCronService {
  private readonly logger = new Logger(PurgeCronService.name);

  constructor(
    private readonly purgeService: PurgeService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /**
   * Runs the purge every day at 3:00 AM server time.
   */
  @Cron('0 3 * * *')
  async handlePurgeCron(): Promise<void> {
    this.logger.log('Starting 12-month retention purge...');

    try {
      const result = await this.purgeService.purgeExpiredRecords(
        this.entityManager,
      );

      this.logger.log(
        `Purge complete: ${result.purged_users} users, ` +
          `${result.purged_documents} documents, ` +
          `${result.purged_recipient_lines} recipient lines purged`,
      );
    } catch (err) {
      this.logger.error('Purge cron job failed', err);
    }
  }
}
