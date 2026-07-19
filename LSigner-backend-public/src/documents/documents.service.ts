import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  RecipientStatus,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { User } from '../entities/user.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SendDocumentDto } from './dto/send-document.dto';
import { normalizeEmail } from '../common/utils/normalize';
import { LocksService } from '../locks/locks.service';
import {
  SentDocumentDetailDto,
  SentDocumentListItemDto,
  SentRecipientListItemDto,
  SentRecipientsListResponseDto,
  SentRecipientsStatsDto,
  SentDocumentsResponseDto,
  SentDocumentStatus,
} from './dto/sent-documents.dto';
import {
  ReceivedDocumentDetailDto,
  ReceivedDocumentListItemDto,
  ReceivedDocumentsResponseDto,
  ReceivedDocumentStatus,
} from './dto/received-documents.dto';
import { TimelineEventRow } from './dto/timeline.dto';

/** Allowed MIME types for document upload. */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

const FILE_SIZE_LIMIT = 150 * 1024 * 1024; // 150 MB

type RecipientSigningProjection = Pick<
  DocumentRecipient,
  | 'id'
  | 'document_id'
  | 'recipient_email'
  | 'recipient_name'
  | 'sent_at'
  | 'signing_status'
  | 'signed_at'
  | 'first_accessed_at'
  | 'last_accessed_at'
>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly locksService: LocksService,
  ) {}

  // =============================================
  // Helpers
  // =============================================

  /**
   * Computes the SHA-256 hex digest of a buffer.
   * @param buffer Raw file bytes
   * @returns 64-character lowercase hex string
   */
  private hashFile(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Validates the uploaded file against size and MIME type constraints.
   * @param file Multer file object
   * @throws ConflictException when the file violates constraints
   */
  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new ConflictException(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    if (file.size > FILE_SIZE_LIMIT) {
      throw new ConflictException(
        `File size ${file.size} bytes exceeds the maximum of ${FILE_SIZE_LIMIT} bytes`,
      );
    }
  }

  /**
   * Returns the document and asserts ownership by the given user.
   * @param documentId Document UUID
   * @param ownerId Owner UUID (from JWT)
   * @param entityManager EntityManager to use for the query
   */
  private async findOwnedDocument(
    documentId: string,
    ownerId: string,
    entityManager: EntityManager,
  ): Promise<Document> {
    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.owner_id !== ownerId) {
      throw new ForbiddenException('You do not own this document');
    }
    return document;
  }

  private groupRecipientsByDocument(
    recipients: RecipientSigningProjection[],
  ): Map<string, RecipientSigningProjection[]> {
    const byDocument = new Map<string, RecipientSigningProjection[]>();
    for (const recipient of recipients) {
      const existing = byDocument.get(recipient.document_id);
      if (existing) {
        existing.push(recipient);
      } else {
        byDocument.set(recipient.document_id, [recipient]);
      }
    }
    return byDocument;
  }

  private deriveSentDocumentStatus(
    document: Document,
    recipients: RecipientSigningProjection[],
  ): SentDocumentStatus {
    if (document.status === DocumentStatus.VOIDED) {
      return SentDocumentStatus.VOIDED;
    }
    if (document.status === DocumentStatus.DELETED) {
      return SentDocumentStatus.DELETED;
    }
    if (document.status === DocumentStatus.SUPERSEDED) {
      return SentDocumentStatus.SUPERSEDED;
    }
    if (document.status === DocumentStatus.DRAFT) {
      return SentDocumentStatus.DRAFT;
    }

    if (recipients.length === 0) {
      return SentDocumentStatus.WAITING;
    }

    const allSigned = recipients.every(
      (recipient) =>
        recipient.signing_status === SigningStatus.SIGNED &&
        recipient.signed_at !== null,
    );

    return allSigned
      ? SentDocumentStatus.COMPLETED
      : SentDocumentStatus.WAITING;
  }

  private deriveSentDocumentDates(
    document: Document,
    recipients: RecipientSigningProjection[],
    status: SentDocumentStatus,
  ): {
    sentAt: Date;
    signedAt: Date | null;
    finalRecipientName: string | null;
  } {
    const sentAt =
      recipients
        .map((recipient) => recipient.sent_at)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? document.updated_at;

    if (status !== SentDocumentStatus.COMPLETED) {
      return {
        sentAt,
        signedAt: null,
        finalRecipientName: null,
      };
    }

    const recipientsWithSignedAt = recipients
      .filter((recipient) => recipient.signed_at !== null)
      .sort(
        (left, right) =>
          (left.signed_at as Date).getTime() -
          (right.signed_at as Date).getTime(),
      );

    const finalRecipient =
      recipientsWithSignedAt[recipientsWithSignedAt.length - 1] ?? null;
    const signedAt = finalRecipient?.signed_at ?? null;

    return {
      sentAt,
      signedAt,
      finalRecipientName: finalRecipient?.recipient_name ?? null,
    };
  }

  // =============================================
  // Queries
  // =============================================

  /**
   * Returns a single document's metadata (without the binary payload).
   * Accessible by the owner or any recipient.
   * @param documentId Document UUID
   * @param userId Authenticated user UUID
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns The document entity with its recipients relation loaded
   */
  async findById(
    documentId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
      relations: ['recipients', 'owner'],
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const isOwner = document.owner_id === userId;
    const isRecipient = document.recipients.some(
      (recipient) => recipient.user_id === userId,
    );
    if (!isOwner && !isRecipient) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return document;
  }

  /**
   * Lists all documents owned by the user plus documents where the user is a recipient.
   * @param userId Authenticated user UUID
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns Deduplicated list of documents sorted by creation date descending
   */
  async findAllForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const owned = await entityManager.find(Document, {
      where: { owner_id: userId },
      order: { created_at: 'DESC' },
    });

    const receivedRecipients = await entityManager.find(DocumentRecipient, {
      where: { user_id: userId },
      relations: ['document'],
    });
    const received = receivedRecipients.map((recipient) => recipient.document);

    // Merge and deduplicate (owner could also be a recipient)
    const map = new Map<string, Document>();
    for (const doc of [...owned, ...received]) {
      map.set(doc.id, doc);
    }
    return [...map.values()].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );
  }

  /**
   * Returns sent-documents metrics and lightweight items for the owner dashboard.
   */
  async findSentDocumentsForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<SentDocumentsResponseDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const sentDocuments = await entityManager.find(Document, {
      where: {
        owner_id: userId,
        status: In([
          DocumentStatus.SENT,
          DocumentStatus.SUPERSEDED,
          DocumentStatus.VOIDED,
        ]),
      },
      order: { created_at: 'DESC' },
    });

    if (sentDocuments.length === 0) {
      return {
        stats: {
          total_sent: 0,
          pending_final_signature: 0,
          unique_recipients: 0,
          completed: 0,
        },
        items: [],
      };
    }

    const documentIds = sentDocuments.map((document) => document.id);
    const recipients = await entityManager.find(DocumentRecipient, {
      where: { document_id: In(documentIds) },
      select: [
        'id',
        'document_id',
        'recipient_email',
        'recipient_name',
        'sent_at',
        'signing_status',
        'signed_at',
        'first_accessed_at',
        'last_accessed_at',
      ],
    });

    const recipientsByDocument = this.groupRecipientsByDocument(recipients);

    const uniqueRecipientEmails = new Set(
      recipients.map((recipient) => recipient.recipient_email),
    );

    const items: SentDocumentListItemDto[] = sentDocuments.map((document) => {
      const documentRecipients = recipientsByDocument.get(document.id) ?? [];
      const status = this.deriveSentDocumentStatus(
        document,
        documentRecipients,
      );
      const { sentAt, signedAt, finalRecipientName } =
        this.deriveSentDocumentDates(document, documentRecipients, status);

      return {
        id: document.id,
        document_name: document.title,
        file_size_bytes: Number(document.file_size),
        sent_at: sentAt.toISOString(),
        signed_at: signedAt ? signedAt.toISOString() : null,
        final_recipient_name: finalRecipientName,
        status,
      };
    });

    const completed = items.filter(
      (item) => item.status === SentDocumentStatus.COMPLETED,
    ).length;
    const pending = items.filter(
      (item) => item.status === SentDocumentStatus.WAITING,
    ).length;

    return {
      stats: {
        total_sent: items.length,
        pending_final_signature: pending,
        unique_recipients: uniqueRecipientEmails.size,
        completed,
      },
      items,
    };
  }

  /**
   * Returns a flat list of DocumentRecipient rows for all sent documents
   * owned by the authenticated user. One row per recipient per document.
   *
   * Mirrors findReceivedDocumentsForUser but filters by document ownership
   * instead of recipient user_id.
   */
  async findSentRecipientsForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<SentRecipientsListResponseDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipients = await entityManager
      .createQueryBuilder(DocumentRecipient, 'dr')
      .innerJoinAndSelect('dr.document', 'doc')
      .where('doc.owner_id = :userId', { userId })
      .andWhere('doc.status IN (:...activeStatuses)', {
        activeStatuses: [
          DocumentStatus.SENT,
          DocumentStatus.SUPERSEDED,
          DocumentStatus.VOIDED,
        ],
      })
      .orderBy('dr.sent_at', 'DESC')
      .getMany();

    const stats: SentRecipientsStatsDto = {
      total: recipients.length,
      pending: recipients.filter(
        (recipient) => recipient.signing_status === SigningStatus.PENDING,
      ).length,
      signed: recipients.filter(
        (recipient) => recipient.signing_status === SigningStatus.SIGNED,
      ).length,
      rejected: recipients.filter(
        (recipient) => recipient.signing_status === SigningStatus.REJECTED,
      ).length,
      revoked: recipients.filter(
        (recipient) => recipient.signing_status === SigningStatus.REVOKED,
      ).length,
    };

    const items: SentRecipientListItemDto[] = recipients.map((recipient) => ({
      recipient_email: recipient.recipient_email,
      recipient_name: recipient.recipient_name,
      signing_status: recipient.signing_status,
      signed_at: recipient.signed_at?.toISOString() ?? null,
      sent_at: recipient.sent_at.toISOString(),
      document_id: recipient.document_id,
      document_name: recipient.document.title,
      first_accessed_at: recipient.first_accessed_at?.toISOString() ?? null,
      last_accessed_at: recipient.last_accessed_at?.toISOString() ?? null,
    }));

    return { stats, items };
  }

  /**
   * Returns a chronological list of document signing events for the
   * authenticated user, covering both sent (owner) and received (recipient)
   * documents.
   *
   * Uses a UNION ALL of two sub-queries:
   * - sent: events on documents where the user is the owner.
   * - received: events on documents where the user is a recipient and NOT
   *   the owner (self-recipient dedup).
   *
   * @param userId Authenticated user UUID
   * @returns Flat array of event rows, sorted by occurred_at DESC, max 200
   */
  async findTimelineForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<TimelineEventRow[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    return entityManager.query(
      `SELECT * FROM (
        -- Sent documents: synthetic SENT event from document_recipients
        (
          SELECT
            'sent-' || dr.id::text AS event_id,
            dr.document_id,
            doc.title AS document_name,
            'SENT'::text AS action,
            dr.sent_at::text AS occurred_at,
            'sent' AS direction,
            dr.recipient_name AS other_party_name,
            dr.recipient_email AS other_party_email
          FROM document_recipients dr
          JOIN documents doc ON doc.id = dr.document_id
          WHERE doc.owner_id = $1
            AND dr.sent_at IS NOT NULL
        )
        UNION ALL
        -- Sent documents: signing events (SIGNED, REJECTED, REVOKED, ACCESS_OPENED)
        (
          SELECT
            dse.id::text AS event_id,
            dse.document_id,
            doc.title AS document_name,
            dse.action::text AS action,
            dse.occurred_at::text AS occurred_at,
            'sent' AS direction,
            dr.recipient_name AS other_party_name,
            dr.recipient_email AS other_party_email
          FROM document_signing_events dse
          JOIN document_recipients dr ON dr.id = dse.recipient_id
          JOIN documents doc ON doc.id = dse.document_id
          WHERE doc.owner_id = $1
        )
        UNION ALL
        -- Received documents: synthetic RECEIVED event
        (
          SELECT
            'recv-' || dr.id::text AS event_id,
            dr.document_id,
            doc.title AS document_name,
            'RECEIVED'::text AS action,
            dr.sent_at::text AS occurred_at,
            'received' AS direction,
            CONCAT(u.name, ' ', u.last_name) AS other_party_name,
            u.email AS other_party_email
          FROM document_recipients dr
          JOIN documents doc ON doc.id = dr.document_id
          JOIN users u ON u.patient_id = doc.owner_id
          WHERE dr.user_id = $2
            AND doc.owner_id != $2
            AND dr.sent_at IS NOT NULL
        )
        UNION ALL
        -- Received documents: signing events
        (
          SELECT
            dse.id::text AS event_id,
            dse.document_id,
            doc.title AS document_name,
            dse.action::text AS action,
            dse.occurred_at::text AS occurred_at,
            'received' AS direction,
            CONCAT(u.name, ' ', u.last_name) AS other_party_name,
            u.email AS other_party_email
          FROM document_signing_events dse
          JOIN document_recipients dr ON dr.id = dse.recipient_id
          JOIN documents doc ON doc.id = dse.document_id
          JOIN users u ON u.patient_id = doc.owner_id
          WHERE dr.user_id = $2
            AND doc.owner_id != $2
        )
      ) AS timeline
      ORDER BY occurred_at DESC,
               (CASE action
                 WHEN 'REVOKED' THEN 5
                 WHEN 'REJECTED' THEN 4
                 WHEN 'SIGNED' THEN 3
                 WHEN 'RECEIVED' THEN 2
                 WHEN 'SENT' THEN 1
                 ELSE 0
               END) DESC
      LIMIT 200`,
      [userId, userId],
    );
  }

  /**
   * Returns a full sent-document payload for owner detail screens.
   */
  async findSentDocumentByIdForUser(
    documentId: string,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<SentDocumentDetailDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await entityManager.findOne(Document, {
      where: { id: documentId },
      relations: ['recipients'],
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.owner_id !== ownerId) {
      throw new ForbiddenException('You do not own this document');
    }
    if (document.status === DocumentStatus.DRAFT) {
      throw new NotFoundException(
        `Document ${documentId} is not in sent status`,
      );
    }

    const recipients =
      document.recipients as unknown as RecipientSigningProjection[];
    const status = this.deriveSentDocumentStatus(document, recipients);
    const { sentAt, signedAt, finalRecipientName } =
      this.deriveSentDocumentDates(document, recipients, status);

    const sortedRecipients = [...document.recipients].sort(
      (left, right) => left.sent_at.getTime() - right.sent_at.getTime(),
    );

    return {
      id: document.id,
      document_name: document.title,
      description: document.description,
      file_size_bytes: Number(document.file_size),
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      version: document.version,
      status,
      sent_at: sentAt.toISOString(),
      signed_at: signedAt ? signedAt.toISOString() : null,
      final_recipient_name: finalRecipientName,
      created_at: document.created_at.toISOString(),
      updated_at: document.updated_at.toISOString(),
      recipients: sortedRecipients.map((recipient) => ({
        id: recipient.id,
        recipient_email: recipient.recipient_email,
        recipient_name: recipient.recipient_name,
        sent_at: recipient.sent_at.toISOString(),
        signing_status: recipient.signing_status,
        first_accessed_at: recipient.first_accessed_at
          ? recipient.first_accessed_at.toISOString()
          : null,
        last_accessed_at: recipient.last_accessed_at
          ? recipient.last_accessed_at.toISOString()
          : null,
        signed_at: recipient.signed_at
          ? recipient.signed_at.toISOString()
          : null,
      })),
    };
  }

  // =============================================
  // Received documents (recipient dashboard)
  // =============================================

  /**
   * Maps document/recipient status to the public ReceivedDocumentStatus enum.
   * Document status takes precedence for terminal non-actionable states.
   */
  private mapSigningStatusToReceivedStatus(
    signingStatus: SigningStatus,
    documentStatus: DocumentStatus,
  ): ReceivedDocumentStatus {
    if (documentStatus === DocumentStatus.CANCELLED) {
      return ReceivedDocumentStatus.REVOKED;
    }

    switch (signingStatus) {
      case SigningStatus.SIGNED:
        return ReceivedDocumentStatus.SIGNED;
      case SigningStatus.REJECTED:
        return ReceivedDocumentStatus.REJECTED;
      case SigningStatus.REVOKED:
        return ReceivedDocumentStatus.REVOKED;
      default:
        return ReceivedDocumentStatus.PENDING;
    }
  }

  /**
   * Returns received-documents metrics and lightweight items for the
   * recipient dashboard. Only includes documents in SENT status
   * (filters out DRAFT / VOIDED).
   *
   * Sorting: PENDING first (oldest received first), then non-PENDING
   * ordered by most recent action descending.
   */
  async findReceivedDocumentsForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<ReceivedDocumentsResponseDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipientRecords = await entityManager.find(DocumentRecipient, {
      where: { user_id: userId },
      relations: ['document', 'document.owner'],
    });

    const activeRecords = recipientRecords.filter(
      (record) =>
        record.document.status === DocumentStatus.SENT ||
        record.document.status === DocumentStatus.CANCELLED,
    );

    if (activeRecords.length === 0) {
      return {
        stats: {
          total_received: 0,
          pending_my_signature: 0,
          signed_by_me: 0,
          rejected_or_revoked: 0,
        },
        items: [],
      };
    }

    const items: ReceivedDocumentListItemDto[] = activeRecords.map(
      (recipient) => {
        const status = this.mapSigningStatusToReceivedStatus(
          recipient.signing_status,
          recipient.document.status,
        );
        return {
          id: recipient.document.id,
          document_name: recipient.document.title,
          file_size_bytes: Number(recipient.document.file_size),
          received_at: recipient.sent_at.toISOString(),
          signed_at: recipient.signed_at?.toISOString() ?? null,
          expires_at: null,
          sender_name: `${recipient.document.owner.name} ${recipient.document.owner.last_name}`,
          sender_email: recipient.document.owner.email,
          status,
        };
      },
    );

    items.sort((a, b) => {
      const aPending = a.status === ReceivedDocumentStatus.PENDING;
      const bPending = b.status === ReceivedDocumentStatus.PENDING;
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;
      if (aPending && bPending) {
        return (
          new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        );
      }
      const aSortTime = a.signed_at ?? a.received_at;
      const bSortTime = b.signed_at ?? b.received_at;
      return new Date(bSortTime).getTime() - new Date(aSortTime).getTime();
    });

    const stats = {
      total_received: items.length,
      pending_my_signature: items.filter(
        (item) => item.status === ReceivedDocumentStatus.PENDING,
      ).length,
      signed_by_me: items.filter(
        (item) => item.status === ReceivedDocumentStatus.SIGNED,
      ).length,
      rejected_or_revoked: items.filter(
        (item) =>
          item.status === ReceivedDocumentStatus.REJECTED ||
          item.status === ReceivedDocumentStatus.REVOKED,
      ).length,
    };

    return { stats, items };
  }

  /**
   * Returns a full received-document payload for recipient detail screens.
   * Throws 404 if the document is not found or the user is not a recipient.
   */
  async findReceivedDocumentByIdForUser(
    documentId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<ReceivedDocumentDetailDto> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // Try as recipient first
    let recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
      relations: ['document', 'document.owner'],
    });

    // If not a recipient, allow document owner to view
    if (!recipient) {
      recipient = await entityManager.findOne(DocumentRecipient, {
        where: { document_id: documentId },
        relations: ['document', 'document.owner'],
      });

      if (
        !recipient ||
        recipient.document.owner_id !== userId ||
        recipient.document.status !== DocumentStatus.SENT
      ) {
        throw new NotFoundException(`Document ${documentId} not found`);
      }
    } else if (
      recipient.document.status !== DocumentStatus.SENT &&
      recipient.document.status !== DocumentStatus.CANCELLED
    ) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const document = recipient.document;
    const status = this.mapSigningStatusToReceivedStatus(
      recipient.signing_status,
      document.status,
    );

    return {
      id: document.id,
      document_name: document.title,
      description: document.description,
      file_size_bytes: Number(document.file_size),
      original_filename: document.original_filename,
      mime_type: document.mime_type,
      version: document.version,
      status,
      received_at: recipient.sent_at.toISOString(),
      signed_at: recipient.signed_at?.toISOString() ?? null,
      expires_at: null,
      created_at: document.created_at.toISOString(),
      updated_at: document.updated_at.toISOString(),
      sender: {
        id: document.owner.patient_id,
        name: `${document.owner.name} ${document.owner.last_name}`,
        email: document.owner.email,
        deleted: document.owner.deleted_at !== null,
      },
      my_recipient: {
        id: recipient.id,
        recipient_email: recipient.recipient_email,
        recipient_name: recipient.recipient_name,
        signing_status: status,
        first_accessed_at: recipient.first_accessed_at?.toISOString() ?? null,
        last_accessed_at: recipient.last_accessed_at?.toISOString() ?? null,
        signed_at: recipient.signed_at?.toISOString() ?? null,
        rejected_at: null,
        revoked_at: null,
      },
    };
  }

  /**
   * Returns the recipient public link identifier for a received document.
   * For registered recipients this value is null because they use JWT-only routes.
   */
  async getReceivedRecipientPublicLinkId(
    documentId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<string | null> {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { document_id: documentId, user_id: userId },
    });

    if (!recipient) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return recipient.public_link_id;
  }

  /**
   * Resolves the view URL for a sent document owned by the authenticated user.
   * Returns the app route for the owner to open the document.
   */
  async getSentDocumentViewUrl(
    documentId: string,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<string> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await this.findOwnedDocument(
      documentId,
      ownerId,
      entityManager,
    );
    if (
      document.status !== DocumentStatus.SENT &&
      document.status !== DocumentStatus.SUPERSEDED &&
      document.status !== DocumentStatus.VOIDED
    ) {
      throw new NotFoundException(`Document ${documentId} is not available`);
    }
    return `/documents/sent/${documentId}`;
  }

  /**
   * Loads the binary payload of a document for download.
   * Accessible by the owner or any recipient.
   * @param documentId Document UUID
   * @param userId Authenticated user UUID
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns Partial document with id, file buffer, mime_type and original_filename
   */
  async download(
    documentId: string,
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<
    Pick<Document, 'id' | 'file' | 'mime_type' | 'original_filename'>
  > {
    const entityManager = transactionalEntityManager ?? this.entityManager;

    // First check access (without loading the binary)
    const doc = await this.findById(documentId, userId, entityManager);

    // If the requester is a recipient (not the owner), enforce lock resolution.
    // findById already loads doc.recipients, so no extra DB query is needed.
    if (doc.owner_id !== userId) {
      const recipient =
        doc.recipients.find((recipient) => recipient.user_id === userId) ??
        null;
      if (recipient) {
        const hasUnresolved = await this.locksService.hasUnresolvedLocks(
          documentId,
          recipient.id,
          entityManager,
        );
        if (hasUnresolved) {
          throw new ForbiddenException(
            'You must resolve all document locks before downloading',
          );
        }
      }
    }

    // Now load only the fields needed for download
    const withFile = await entityManager
      .createQueryBuilder(Document, 'doc')
      .select(['doc.id', 'doc.file', 'doc.mime_type', 'doc.original_filename'])
      .where('doc.id = :id', { id: documentId })
      .getOne();

    if (!withFile) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return withFile;
  }

  // =============================================
  // Mutations
  // =============================================

  /**
   * Creates a new document from an uploaded file.
   * @param dto Title and optional description
   * @param file Multer file object with the binary payload
   * @param ownerId UUID of the authenticated user (from JWT)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns The created document entity without the binary payload
   */
  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    if (!file) {
      throw new BadRequestException('A file is required to create a document');
    }
    this.validateFile(file);

    const fileHash = this.hashFile(file.buffer);

    const document = entityManager.create(Document, {
      owner_id: ownerId,
      title: dto.title,
      description: dto.description ?? null,
      file: file.buffer,
      file_hash: fileHash,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size: String(file.size),
      status: DocumentStatus.DRAFT,
      version: 1,
    });

    const saved = await entityManager.save(document);
    // Remove the binary from the response
    delete (saved as Partial<Document>).file;
    return saved;
  }

  /**
   * Updates a document. The behaviour depends on the current status:
   * - DRAFT: updates metadata and/or file in-place.
   * - SENT:  creates a new version, marks the old one as SUPERSEDED,
   *          and marks all its recipients as UPDATED.
   * - SUPERSEDED / VOIDED: rejected (409 Conflict).
   *
   * @param documentId Document UUID
   * @param dto Updated metadata fields
   * @param file Optional new file to replace the existing one
   * @param ownerId UUID of the authenticated user (from JWT)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns The updated document (DRAFT path) or the new version document (SENT path)
   */
  async update(
    documentId: string,
    dto: UpdateDocumentDto,
    file: Express.Multer.File | undefined,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await this.findOwnedDocument(
      documentId,
      ownerId,
      entityManager,
    );

    if (
      document.status === DocumentStatus.SUPERSEDED ||
      document.status === DocumentStatus.VOIDED ||
      document.status === DocumentStatus.DELETED
    ) {
      throw new ConflictException(
        `Cannot update a document with status "${document.status}". The document may have been deleted or superseded.`,
      );
    }

    if (file) {
      this.validateFile(file);
    }

    // DRAFT: update in-place
    if (document.status === DocumentStatus.DRAFT) {
      if (dto.title !== undefined) document.title = dto.title;
      if (dto.description !== undefined)
        document.description = dto.description ?? null;

      if (file) {
        document.file = file.buffer;
        document.file_hash = this.hashFile(file.buffer);
        document.original_filename = file.originalname;
        document.mime_type = file.mimetype;
        document.file_size = String(file.size);
      }

      const saved = await entityManager.save(document);
      delete (saved as Partial<Document>).file;
      return saved;
    }

    // SENT: create new version
    const rootId = document.parent_document_id ?? document.id;

    const newDocument = entityManager.create(Document, {
      owner_id: ownerId,
      title: dto.title ?? document.title,
      description:
        dto.description !== undefined
          ? (dto.description ?? null)
          : document.description,
      file: file ? file.buffer : undefined,
      file_hash: file ? this.hashFile(file.buffer) : document.file_hash,
      original_filename: file ? file.originalname : document.original_filename,
      mime_type: file ? file.mimetype : document.mime_type,
      file_size: file ? String(file.size) : document.file_size,
      status: DocumentStatus.DRAFT,
      version: document.version + 1,
      parent_document_id: rootId,
    });

    // If no new file provided, copy the binary from the old document
    if (!file) {
      const oldWithFile = await entityManager
        .createQueryBuilder(Document, 'doc')
        .select(['doc.id', 'doc.file'])
        .where('doc.id = :id', { id: document.id })
        .getOne();
      if (oldWithFile) {
        newDocument.file = oldWithFile.file;
      }
    }

    // Mark old document as superseded
    document.status = DocumentStatus.SUPERSEDED;
    await entityManager.save(document);

    // Mark all recipients of the old document as UPDATED
    await entityManager.update(
      DocumentRecipient,
      { document_id: document.id },
      { status: RecipientStatus.UPDATED },
    );

    const saved = await entityManager.save(newDocument);
    delete (saved as Partial<Document>).file;
    return saved;
  }

  /**
   * Deletes or voids a document depending on its status:
   * - DRAFT / SUPERSEDED: hard delete (no evidence to preserve).
   * - SENT: soft delete (status -> DELETED).
   * - VOIDED / DELETED: already voided or deleted, no-op — returns silently.
   *
   * @param documentId Document UUID
   * @param ownerId UUID of the authenticated user (from JWT)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   */
  async remove(
    documentId: string,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await this.findOwnedDocument(
      documentId,
      ownerId,
      entityManager,
    );

    switch (document.status) {
      case DocumentStatus.DRAFT:
        await entityManager.remove(document);
        return;

      case DocumentStatus.SUPERSEDED: {
        // Prevent deleting a superseded document that is the root of a version
        // chain. Later versions store parent_document_id = root.id, so deleting
        // the root would null-out that FK for all descendants and make the
        // version history unqueryable.
        const hasVersions = await entityManager.findOne(Document, {
          where: { parent_document_id: document.id },
          select: ['id'],
        });
        if (hasVersions) {
          throw new ConflictException(
            `Document ${document.id} is the root of a version chain and cannot be deleted. ` +
              `Delete or void all derived versions first.`,
          );
        }
        await entityManager.remove(document);
        return;
      }

      case DocumentStatus.SENT:
        document.status = DocumentStatus.DELETED;
        await entityManager.save(document);
        return;

      case DocumentStatus.VOIDED:
        // Already voided — idempotent
        return;

      case DocumentStatus.DELETED:
        // Already deleted — idempotent
        return;
    }
  }

  /**
   * Sends a document to one or more recipients and transitions its status to SENT.
   * - Validates that the document is in DRAFT status.
   * - Validates that referenced user IDs exist.
   * - Normalises recipient emails to canonical form.
   * - Auto-resolves user_id from email when not explicitly provided.
   *
   * @param documentId Document UUID
   * @param dto Array of recipients
   * @param ownerId UUID of the authenticated user (from JWT)
   * @param transactionalEntityManager EntityManager passed from the caller's transaction
   * @returns The sent document with its recipients populated
   */
  async send(
    documentId: string,
    dto: SendDocumentDto,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await this.findOwnedDocument(
      documentId,
      ownerId,
      entityManager,
    );

    if (document.status !== DocumentStatus.DRAFT) {
      throw new ConflictException(
        `Document must be in DRAFT status to send (current: "${document.status}")`,
      );
    }

    const now = new Date();
    const recipients: DocumentRecipient[] = [];

    //  Bulk pre-load to avoid N+1 queries

    // Canonical emails for all incoming recipients
    const incomingEmails = dto.recipients.map((recipient) =>
      normalizeEmail(recipient.recipient_email),
    );

    // 1. Validate and resolve users referenced by explicit user_id in one query
    const explicitUserIds = dto.recipients
      .filter((recipient) => recipient.user_id)
      .map((recipient) => recipient.user_id as string);

    const usersByPatientId = new Map<string, User>();
    if (explicitUserIds.length > 0) {
      const users = await entityManager.find(User, {
        where: { patient_id: In(explicitUserIds), deleted_at: IsNull() },
      });
      for (const user of users) {
        usersByPatientId.set(user.patient_id, user);
      }
      // Validate that every referenced user_id was found
      for (const userId of explicitUserIds) {
        if (!usersByPatientId.has(userId)) {
          throw new NotFoundException(`Recipient user ${userId} not found`);
        }
      }
    }

    // 2. Auto-resolve users for recipients without explicit user_id, by email
    const emailsToResolve = dto.recipients
      .filter((recipient) => !recipient.user_id)
      .map((recipient) => normalizeEmail(recipient.recipient_email));

    const usersByEmail = new Map<string, User>();
    if (emailsToResolve.length > 0) {
      const users = await entityManager.find(User, {
        where: { email: In(emailsToResolve), deleted_at: IsNull() },
      });
      for (const user of users) {
        usersByEmail.set(user.email, user);
      }
    }

    // 3. Bulk-load existing recipients to detect duplicates in-memory
    const existingRecipients = await entityManager.find(DocumentRecipient, {
      where: { document_id: documentId, recipient_email: In(incomingEmails) },
      select: ['recipient_email'],
    });
    const existingEmailSet = new Set(
      existingRecipients.map((recipient) => recipient.recipient_email),
    );

    //  Build recipient rows (no DB queries inside loop)
    const seenEmailsInBatch = new Set<string>();

    for (const recipientData of dto.recipients) {
      const canonicalEmail = normalizeEmail(recipientData.recipient_email);

      if (existingEmailSet.has(canonicalEmail)) {
        throw new ConflictException(
          `Recipient "${canonicalEmail}" has already been added to this document`,
        );
      }

      if (seenEmailsInBatch.has(canonicalEmail)) {
        throw new ConflictException(
          `Duplicate recipient "${canonicalEmail}" in the same request`,
        );
      }
      seenEmailsInBatch.add(canonicalEmail);

      const resolvedUserId = recipientData.user_id
        ? (usersByPatientId.get(recipientData.user_id)?.patient_id ?? null)
        : (usersByEmail.get(canonicalEmail)?.patient_id ?? null);

      const publicLinkId = resolvedUserId
        ? null
        : crypto.randomBytes(32).toString('hex');

      const recipient = entityManager.create(DocumentRecipient, {
        document_id: documentId,
        user_id: resolvedUserId,
        recipient_email: canonicalEmail,
        recipient_name: recipientData.recipient_name ?? null,
        public_link_id: publicLinkId,
        status: RecipientStatus.PENDING,
        sent_at: now,
      });
      recipients.push(recipient);
    }

    await entityManager.save(recipients);

    // Apply protection locks if provided
    if (dto.locks && dto.locks.length > 0) {
      await this.locksService.applyLocks(documentId, dto.locks, entityManager);
    }

    document.status = DocumentStatus.SENT;
    const saved = await entityManager.save(document);
    saved.recipients = recipients;
    return saved;
  }

  /**
   * Sends a reminder email to a recipient of a sent document.
   *
   * Validates:
   * - The document exists and is SENT
   * - The caller is the document owner
   * - The recipient exists and has PENDING signing status
   *
   * Returns email context so the controller can fire-and-forget after the
   * transaction commits.
   */
  async sendSentDocumentReminder(
    documentId: string,
    recipientId: string,
    ownerId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<{
    recipientEmail: string;
    recipientName: string;
    documentName: string;
    senderName: string;
    recipientPublicLinkId: string | null;
    documentId: string;
  }> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const document = await this.findOwnedDocument(
      documentId,
      ownerId,
      entityManager,
    );

    if (document.status !== DocumentStatus.SENT) {
      throw new ConflictException(
        `Document must be in SENT status to send a reminder (current: "${document.status}")`,
      );
    }

    const recipient = await entityManager.findOne(DocumentRecipient, {
      where: { id: recipientId, document_id: documentId },
    });

    if (!recipient) {
      throw new NotFoundException(
        `Recipient ${recipientId} not found for document ${documentId}`,
      );
    }

    if (recipient.signing_status !== SigningStatus.PENDING) {
      throw new ConflictException(
        'Reminders can only be sent to recipients with PENDING status',
      );
    }

    // Fetch the owner user to get the sender name
    const owner = await entityManager.findOne(User, {
      where: { patient_id: ownerId },
      select: ['patient_id', 'name', 'last_name'],
    });

    const senderName = owner
      ? `${owner.name} ${owner.last_name}`
      : 'Unknown sender';

    this.logger.log(
      `Reminder triggered for recipient ${recipient.recipient_email} on document ${document.title} by owner ${ownerId}`,
    );

    return {
      recipientEmail: recipient.recipient_email,
      recipientName: recipient.recipient_name ?? 'there',
      documentName: document.title,
      senderName,
      recipientPublicLinkId: recipient.public_link_id ?? null,
      documentId: document.id,
    };
  }

  /**
   * Records that a recipient has accessed a document.
   * Uses COALESCE for first-write semantics: first_accessed_at is only set once,
   * while last_accessed_at is always updated to the current timestamp.
   *
   * @param recipientId The DocumentRecipient UUID
   * @param transactionalEntityManager Optional EntityManager (uses injected one if not provided)
   */
  async recordAccess(
    recipientId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const now = new Date();
    await entityManager
      .createQueryBuilder()
      .update(DocumentRecipient)
      .set({
        first_accessed_at: () =>
          `COALESCE(first_accessed_at, '${now.toISOString()}'::timestamptz)`,
        last_accessed_at: () => `'${now.toISOString()}'::timestamptz`,
      })
      .where('id = :id', { id: recipientId })
      .execute();
  }

  /**
   * Returns documents owned by the authenticated user (sent by them).
   */
  async findSentForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    return entityManager.find(Document, {
      where: { owner_id: userId },
      relations: ['recipients', 'owner'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Returns documents where the authenticated user is a recipient
   * (received by them, excluding documents they own).
   */
  async findReceivedForUser(
    userId: string,
    transactionalEntityManager?: EntityManager,
  ): Promise<Document[]> {
    const entityManager = transactionalEntityManager ?? this.entityManager;
    const recipients = await entityManager.find(DocumentRecipient, {
      where: { user_id: userId },
      relations: ['document.owner', 'document.recipients'],
    });
    const docs = recipients
      .map((recipient) => recipient.document)
      .filter((doc) => doc.owner_id !== userId);
    this.logger.log(
      `findReceivedForUser userId=${userId} -> ${recipients.length} recipients -> ${docs.length} docs`,
    );
    return docs;
  }
}
