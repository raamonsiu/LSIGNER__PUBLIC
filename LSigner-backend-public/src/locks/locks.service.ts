import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError } from 'typeorm';
import { DocumentLock } from '../entities/document-lock.entity';
import { DocumentLockResolution } from '../entities/document-lock-resolution.entity';
import { DocumentRecipient } from '../entities/document-recipient.entity';
import { Document } from '../entities/document.entity';
import { LockHandlerRegistry } from './lock-handler.registry';
import { ApplyLockDto } from './dto/apply-lock.dto';
import { ResolveLockDto } from './dto/resolve-lock.dto';
import { LockStatusDto } from './dto/lock-status.dto';
import { LockOverviewDto } from './dto/lock-overview.dto';

@Injectable()
export class LocksService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly registry: LockHandlerRegistry,
  ) {}

  // ====================================================
  // Mutations
  // ====================================================

  /**
   * Creates DocumentLock records for a document.
   * Must be called within an active transaction (from the send flow).
   *
   * @param documentId Document UUID
   * @param locks Array of lock descriptors from the sender
   * @param transactionalEntityManager EntityManager from the caller's transaction
   * @returns Saved DocumentLock entities
   */
  async applyLocks(
    documentId: string,
    locks: ApplyLockDto[],
    transactionalEntityManager: EntityManager,
  ): Promise<DocumentLock[]> {
    const toSave: DocumentLock[] = [];

    for (const lockDto of locks) {
      const handler = this.registry.get(lockDto.type);
      const config = await handler.apply(lockDto);

      const lock = transactionalEntityManager.create(DocumentLock, {
        document_id: documentId,
        lock_type: lockDto.type,
        config,
      });
      toSave.push(lock);
    }

    return transactionalEntityManager.save(toSave);
  }

  /**
   * Verifies the recipient's payload and records a lock resolution.
   *
   * @param lockId DocumentLock UUID
   * @param documentId Document UUID : used to validate the lock belongs to it
   * @param userId Authenticated user UUID (from JWT)
   * @param dto Resolution payload (e.g. plaintext password)
   * @param transactionalEntityManager EntityManager passed from the controller transaction
   * @throws NotFoundException when the lock does not exist or belong to the document
   * @throws ForbiddenException when the user is not a recipient of the document
   * @throws ConflictException when the lock has already been resolved by this user
   */
  async resolveLock(
    lockId: string,
    documentId: string,
    userId: string,
    dto: ResolveLockDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Load the lock with its config (select: false requires explicit selection)
    const lock = await entityManager
      .createQueryBuilder(DocumentLock, 'dl')
      .addSelect('dl.config')
      .where('dl.id = :lockId AND dl.document_id = :documentId', {
        lockId,
        documentId,
      })
      .getOne();

    if (!lock) {
      throw new NotFoundException(
        `Lock ${lockId} not found on document ${documentId}`,
      );
    }

    // Verify the requesting user is a recipient of this document
    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
    });
    if (!recipient) {
      throw new ForbiddenException('You are not a recipient of this document');
    }

    // Delegate verification to the handler
    const handler = this.registry.get(lock.lock_type);
    await handler.verify(lock.config, dto);

    // Persist the resolution : rely on the DB unique constraint (lock_id, recipient_id)
    // for idempotency. Catching the violation here avoids a pre-check race window
    // where two concurrent requests could both pass a findOne guard and then one
    // would surface a raw 500.
    const resolution = entityManager.create(DocumentLockResolution, {
      lock_id: lockId,
      recipient_id: recipient.id,
      resolved_at: new Date(),
    });
    try {
      await entityManager.save(resolution);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new ConflictException('This lock has already been resolved');
      }
      throw err;
    }
  }

  // ====================================================
  // Queries
  // ====================================================

  /**
   * Returns all locks for a document with their resolution status for the
   * requesting user.
   *
   * Owners of the document always see `is_resolved: false` because they are
   * not tracked as recipients and bypass lock checks during download.
   *
   * @param documentId Document UUID
   * @param userId Authenticated user UUID (from JWT)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @throws NotFoundException when the document does not exist
   * @throws ForbiddenException when the user is neither owner nor recipient
   * @returns Array of LockStatusDto sorted by creation date
   */
  async getLocksForDocument(
    documentId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<LockStatusDto[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Access control: only owner or recipients may see the locks
    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const isOwner = document.owner_id === userId;

    // For non-owners, verify they are a recipient and keep the record for reuse
    let recipient: DocumentRecipient | null = null;
    if (!isOwner) {
      recipient = await entityManager.findOne(DocumentRecipient, {
        where: { document_id: documentId, user_id: userId },
      });
      if (!recipient) {
        throw new ForbiddenException('You do not have access to this document');
      }
    }

    const locks = await entityManager.find(DocumentLock, {
      where: { document_id: documentId },
      order: { created_at: 'ASC' },
    });

    if (locks.length === 0) {
      return [];
    }

    const resolutionMap = new Map<string, Date>();

    if (recipient) {
      const lockIds = locks.map((lock) => lock.id);
      const resolutions = await entityManager.find(DocumentLockResolution, {
        where: { lock_id: In(lockIds), recipient_id: recipient.id },
        select: ['lock_id', 'resolved_at'],
      });
      for (const resolution of resolutions) {
        resolutionMap.set(resolution.lock_id, resolution.resolved_at);
      }
    }

    return locks.map((lock) => ({
      id: lock.id,
      lock_type: lock.lock_type,
      is_resolved: resolutionMap.has(lock.id),
      resolved_at: resolutionMap.get(lock.id) ?? null,
    }));
  }

  /**
   * Returns true when the given recipient has at least one unresolved lock
   * on the document. Used to gate the download endpoint.
   *
   * @param documentId Document UUID
   * @param recipientId DocumentRecipient UUID (not user UUID)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async hasUnresolvedLocks(
    documentId: string,
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<boolean> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const count = await entityManager
      .createQueryBuilder(DocumentLock, 'dl')
      .leftJoin(
        DocumentLockResolution,
        'dlr',
        'dlr.lock_id = dl.id AND dlr.recipient_id = :recipientId',
        { recipientId },
      )
      .where('dl.document_id = :documentId', { documentId })
      .andWhere('dlr.id IS NULL')
      .getCount();

    return count > 0;
  }

  /**
   * Returns all locks for a document with their resolution status for a
   * specific recipient (identified by recipient row ID, not user ID).
   * Used by the shared/public access flow for external recipients.
   */
  async getLocksForRecipient(
    documentId: string,
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<LockStatusDto[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const locks = await entityManager.find(DocumentLock, {
      where: { document_id: documentId },
      order: { created_at: 'ASC' },
    });

    if (locks.length === 0) {
      return [];
    }

    const lockIds = locks.map((lock) => lock.id);
    const resolutions = await entityManager.find(DocumentLockResolution, {
      where: { lock_id: In(lockIds), recipient_id: recipientId },
      select: ['lock_id', 'resolved_at'],
    });

    const resolutionMap = new Map<string, Date>();
    for (const resolution of resolutions) {
      resolutionMap.set(resolution.lock_id, resolution.resolved_at);
    }

    return locks.map((lock) => ({
      id: lock.id,
      lock_type: lock.lock_type,
      is_resolved: resolutionMap.has(lock.id),
      resolved_at: resolutionMap.get(lock.id) ?? null,
    }));
  }

  /**
   * Resolves a lock for a specific recipient (identified by recipient row ID).
   * Used by the shared/public access flow for external recipients.
   */
  async resolveLockForRecipient(
    lockId: string,
    documentId: string,
    recipientId: string,
    dto: ResolveLockDto,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Load the lock with its config
    const lock = await entityManager
      .createQueryBuilder(DocumentLock, 'dl')
      .addSelect('dl.config')
      .where('dl.id = :lockId AND dl.document_id = :documentId', {
        lockId,
        documentId,
      })
      .getOne();

    if (!lock) {
      throw new NotFoundException(
        `Lock ${lockId} not found on document ${documentId}`,
      );
    }

    // Delegate verification to the handler
    const handler = this.registry.get(lock.lock_type);
    await handler.verify(lock.config, dto);

    // Persist the resolution
    const resolution = entityManager.create(DocumentLockResolution, {
      lock_id: lockId,
      recipient_id: recipientId,
      resolved_at: new Date(),
    });
    try {
      await entityManager.save(resolution);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new ConflictException('This lock has already been resolved');
      }
      throw err;
    }
  }

  /**
   * Returns all locks for a document with the resolution status of ALL
   * recipients. Intended for the document owner to get a full overview.
   *
   * @param documentId Document UUID
   * @param ownerId Authenticated user UUID : must be the document owner
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @throws NotFoundException when the document does not exist
   * @throws ForbiddenException when the user is not the document owner
   * @returns Array of LockOverviewDto sorted by creation date
   */
  async getLocksOverview(
    documentId: string,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<LockOverviewDto[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Access control: only the owner may see the full overview
    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.owner_id !== ownerId) {
      throw new ForbiddenException(
        'Only the document owner can view the locks overview',
      );
    }

    // Load all recipients of this document
    const recipients = await entityManager.find(DocumentRecipient, {
      where: { document_id: documentId },
      order: { created_at: 'ASC' },
    });

    // Load all locks
    const locks = await entityManager.find(DocumentLock, {
      where: { document_id: documentId },
      order: { created_at: 'ASC' },
    });

    if (locks.length === 0) {
      return [];
    }

    // Load all resolutions for this document's locks in one query
    const lockIds = locks.map((lock) => lock.id);
    const resolutions = await entityManager.find(DocumentLockResolution, {
      where: { lock_id: In(lockIds) },
      select: ['lock_id', 'recipient_id', 'resolved_at'],
    });

    // Index resolutions by lock_id -> recipient_id -> resolved_at
    const resolutionMap = new Map<string, Map<string, Date>>();
    for (const resolution of resolutions) {
      if (!resolutionMap.has(resolution.lock_id)) {
        resolutionMap.set(resolution.lock_id, new Map());
      }
      resolutionMap
        .get(resolution.lock_id)!
        .set(resolution.recipient_id, resolution.resolved_at);
    }

    return locks.map((lock) => {
      const lockResolutions = resolutionMap.get(lock.id);
      return {
        id: lock.id,
        lock_type: lock.lock_type,
        recipients: recipients.map((recipient) => ({
          recipient_id: recipient.id,
          recipient_email: recipient.recipient_email,
          recipient_name: recipient.recipient_name,
          is_resolved: lockResolutions?.has(recipient.id) ?? false,
          resolved_at: lockResolutions?.get(recipient.id) ?? null,
        })),
      };
    });
  }
}
