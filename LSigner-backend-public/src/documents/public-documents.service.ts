import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Document } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { LocksService } from '../locks/locks.service';
import { LockStatusDto } from '../locks/dto/lock-status.dto';
import { ResolveLockDto } from '../locks/dto/resolve-lock.dto';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import type { AccessContext } from '../document-signing/document-signing.service';
import { findRecipientById as sharedFindRecipientById } from '../shared/recipient-helper';

@Injectable()
export class PublicDocumentsService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly locksService: LocksService,
    private readonly documentSigningService: DocumentSigningService,
  ) {}

  private async findRecipientById(
    recipientId: string,
    entityManager: EntityManager,
  ): Promise<DocumentRecipient> {
    const recipient = await sharedFindRecipientById(recipientId, entityManager);

    if (recipient.signing_status === SigningStatus.REVOKED) {
      throw new NotFoundException('This public link is no longer available');
    }

    return recipient;
  }

  /**
   * Records access and returns the public document for a recipient.
   * Used by the public "find mine" endpoint which tracks access in the same transaction.
   */
  async findMine(
    recipientId: string,
    context: AccessContext,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    await this.documentSigningService.recordAccessByRecipientId(
      recipientId,
      context,
      entityManager,
    );

    return this.findByRecipientId(recipientId, entityManager);
  }

  async findByRecipientId(
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientById(recipientId, entityManager);

    const document = await entityManager.findOne(Document, {
      where: { id: recipient.document_id },
      relations: ['recipients'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async downloadByRecipientId(
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<
    Pick<Document, 'id' | 'file' | 'mime_type' | 'original_filename'>
  > {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientById(recipientId, entityManager);

    const hasUnresolved = await this.locksService.hasUnresolvedLocks(
      recipient.document_id,
      recipient.id,
      entityManager,
    );
    if (hasUnresolved) {
      throw new ForbiddenException(
        'You must resolve all document locks before downloading',
      );
    }

    const withFile = await entityManager
      .createQueryBuilder(Document, 'doc')
      .select(['doc.id', 'doc.file', 'doc.mime_type', 'doc.original_filename'])
      .where('doc.id = :id', { id: recipient.document_id })
      .getOne();

    if (!withFile) {
      throw new NotFoundException('Document not found');
    }

    return withFile;
  }

  async getLocksByRecipientId(
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<LockStatusDto[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientById(recipientId, entityManager);

    return this.locksService.getLocksForRecipient(
      recipient.document_id,
      recipient.id,
      entityManager,
    );
  }

  async resolveLockByRecipientId(
    recipientId: string,
    lockId: string,
    dto: ResolveLockDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipient = await this.findRecipientById(recipientId, entityManager);

    await this.locksService.resolveLockForRecipient(
      lockId,
      recipient.document_id,
      recipient.id,
      dto,
      entityManager,
    );
  }
}
