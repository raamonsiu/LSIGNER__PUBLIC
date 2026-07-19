import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DocumentStatus } from '../entities/document.entity';
import { DocumentRecipient } from '../entities/document-recipient.entity';

/**
 * Finds a recipient by its ID, including the document relation.
 *
 * Throws NotFoundException if the recipient does not exist or if the
 * associated document has been voided.
 */
export async function findRecipientById(
  recipientId: string,
  entityManager: EntityManager,
): Promise<DocumentRecipient> {
  const recipient = await entityManager.findOne(DocumentRecipient, {
    where: { id: recipientId },
    relations: ['document'],
  });

  if (!recipient) {
    throw new NotFoundException('Recipient not found');
  }

  if (recipient.document.status === DocumentStatus.VOIDED) {
    throw new NotFoundException('This document is no longer available');
  }

  return recipient;
}
