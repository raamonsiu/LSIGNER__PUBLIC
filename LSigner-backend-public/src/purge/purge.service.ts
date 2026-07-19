import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, LessThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';

export interface PurgeResult {
  purged_users: number;
  purged_documents: number;
  purged_recipient_lines: number;
}

/**
 * Purges records that have passed the 12-month retention period after
 * account deletion:
 * - Removes users whose `deleted_at` is older than 12 months
 * - Removes their CANCELLED documents
 * - Removes their EXPIRED recipient signature lines
 *
 * The service is designed to be callable from both a cron job and
 * unit tests — the cron wrapper (PurgeCronService) only adds the
 * @Cron decorator and delegates here.
 */
@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /**
   * Finds and purges all records whose retention period (12 months after
   * soft-delete) has expired.
   *
   * @param transactionalEntityManager Optional — passed from cron or test
   * @returns Summary of what was purged
   */
  async purgeExpiredRecords(
    transactionalEntityManager?: EntityManager,
  ): Promise<PurgeResult> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // 1. Find users whose deleted_at is older than 12 months
    const expiredUsers = await entityManager.find(User, {
      where: { deleted_at: LessThan(twelveMonthsAgo) },
    });

    if (expiredUsers.length === 0) {
      return {
        purged_users: 0,
        purged_documents: 0,
        purged_recipient_lines: 0,
      };
    }

    let totalDocuments = 0;
    let totalRecipients = 0;

    for (const user of expiredUsers) {
      const patientId = user.patient_id;

      // 2. Purge CANCELLED documents owned by this user
      const cancelledDocs = await entityManager.find(Document, {
        where: { owner_id: patientId, status: DocumentStatus.CANCELLED },
      });
      for (const doc of cancelledDocs) {
        await entityManager.remove(doc);
      }
      totalDocuments += cancelledDocs.length;

      // 3. Purge EXPIRED recipient lines for this user
      const expiredRecipients = await entityManager.find(DocumentRecipient, {
        where: { user_id: patientId, signing_status: SigningStatus.EXPIRED },
      });
      for (const recipient of expiredRecipients) {
        await entityManager.remove(recipient);
      }
      totalRecipients += expiredRecipients.length;

      // 4. Remove the user record entirely
      await entityManager.remove(user);

      this.logger.log(
        `Purged user ${patientId}: ${cancelledDocs.length} documents, ${expiredRecipients.length} recipient lines`,
      );
    }

    return {
      purged_users: expiredUsers.length,
      purged_documents: totalDocuments,
      purged_recipient_lines: totalRecipients,
    };
  }
}
