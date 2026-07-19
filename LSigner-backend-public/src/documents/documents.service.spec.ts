import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { DocumentsService } from './documents.service';
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
import { LocksService } from '../locks/locks.service';
import { SentDocumentStatus } from './dto/sent-documents.dto';
import { DocumentSigningEventAction } from '../entities/document-signing-event.entity';
import { TimelineEventRow } from './dto/timeline.dto';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const OTHER_USER_ID = 'b4cc290f-9ca0-4999-0023-bdf5f7654113';
const DOC_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';
const DOC_ID_2 = 'd6ee412b-1bc2-6111-2245-dfh7h9876335';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    patient_id: OTHER_USER_ID,
    name: 'Alice',
    last_name: 'Example',
    country: 'Spain',
    email: 'alice@example.com',
    phone_number: '+34600000000',
    national_id: null,
    passport: null,
    ...overrides,
  } as User;
}

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'contract.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake-pdf-content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: DOC_ID,
    owner_id: OWNER_ID,
    title: 'Test Document',
    description: null,
    file: Buffer.from('fake-pdf-content'),
    file_hash: 'abcdef1234567890',
    original_filename: 'contract.pdf',
    mime_type: 'application/pdf',
    file_size: '1024',
    status: DocumentStatus.DRAFT,
    version: 1,
    parent_document_id: null,
    parent_document: null,
    recipients: [],
    owner: {} as User,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  } as Document;
}

function makeRecipient(
  overrides: Partial<DocumentRecipient> = {},
): DocumentRecipient {
  return {
    id: 'r1',
    document_id: DOC_ID,
    user_id: OWNER_ID,
    recipient_email: 'alice@example.com',
    recipient_name: 'Alice',
    public_link_id: null,
    status: RecipientStatus.PENDING,
    sent_at: new Date(),
    first_accessed_at: null,
    last_accessed_at: null,
    signing_status: SigningStatus.PENDING,
    signed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    document: {} as Document,
    user: null,
    signing_events: [],
    signed_artifact: null,
    ...overrides,
  };
}

const CREATE_DTO: CreateDocumentDto = {
  title: 'Employment Contract 2026',
  description: 'Standard employment contract',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DocumentsService', () => {
  let service: DocumentsService;
  let em: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
  };
  let locksService: { applyLocks: jest.Mock; hasUnresolvedLocks: jest.Mock };
  let qb: Partial<SelectQueryBuilder<Document>>;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    em = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
        ...data,
      })),
      save: jest.fn((entity) =>
        Array.isArray(entity)
          ? Promise.resolve(entity)
          : Promise.resolve({ id: DOC_ID, ...entity }),
      ),
      remove: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      query: jest.fn(),
    };

    locksService = {
      applyLocks: jest.fn().mockResolvedValue([]),
      hasUnresolvedLocks: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: EntityManager, useValue: em },
        { provide: LocksService, useValue: locksService },
      ],
    }).compile();

    service = module.get(DocumentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a document in DRAFT status', async () => {
      const file = makeFile();
      const result = await service.create(
        CREATE_DTO,
        file,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(em.create).toHaveBeenCalledWith(
        Document,
        expect.objectContaining({
          owner_id: OWNER_ID,
          title: CREATE_DTO.title,
          description: CREATE_DTO.description,
          original_filename: 'contract.pdf',
          mime_type: 'application/pdf',
          status: DocumentStatus.DRAFT,
          version: 1,
        }),
      );
      expect(em.save).toHaveBeenCalled();
      // Binary should be stripped from the response
      expect(result.file).toBeUndefined();
    });

    it('rejects unsupported MIME types', async () => {
      const file = makeFile({ mimetype: 'image/png' });

      await expect(
        service.create(
          CREATE_DTO,
          file,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects files exceeding 150 MB', async () => {
      const file = makeFile({ size: 200 * 1024 * 1024 });

      await expect(
        service.create(
          CREATE_DTO,
          file,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns a document when the user is the owner', async () => {
      const doc = makeDocument();
      em.findOne.mockResolvedValueOnce(doc);

      const result = await service.findById(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );
      expect(result).toEqual(doc);
    });

    it('returns a document when the user is a recipient', async () => {
      const doc = makeDocument({
        owner_id: OTHER_USER_ID,
        recipients: [makeRecipient({ user_id: OWNER_ID })],
      });
      em.findOne.mockResolvedValueOnce(doc);

      const result = await service.findById(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );
      expect(result).toEqual(doc);
    });

    it('throws NotFoundException when document does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findById(DOC_ID, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is neither owner nor recipient', async () => {
      const doc = makeDocument({ owner_id: OTHER_USER_ID });
      em.findOne.mockResolvedValueOnce(doc);

      await expect(
        service.findById(DOC_ID, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── update (DRAFT) ─────────────────────────────────────────────────────────

  describe('update (DRAFT document)', () => {
    it('updates metadata in-place without a new file', async () => {
      const doc = makeDocument();
      em.findOne.mockResolvedValueOnce(doc);

      const dto: UpdateDocumentDto = { title: 'Updated Title' };
      const result = await service.update(
        DOC_ID,
        dto,
        undefined,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.title).toBe('Updated Title');
      expect(em.save).toHaveBeenCalled();
    });

    it('replaces the file and recomputes hash', async () => {
      const doc = makeDocument();
      em.findOne.mockResolvedValueOnce(doc);

      const newFile = makeFile({
        buffer: Buffer.from('new-content'),
        originalname: 'updated.pdf',
        size: 2048,
      });
      const result = await service.update(
        DOC_ID,
        {},
        newFile,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.original_filename).toBe('updated.pdf');
      expect(result.file_size).toBe('2048');
      expect(result.file).toBeUndefined(); // binary stripped
    });
  });

  // ── update (SENT) ──────────────────────────────────────────────────────────

  describe('update (SENT document)', () => {
    it('creates a new version and marks old as SUPERSEDED', async () => {
      const doc = makeDocument({ status: DocumentStatus.SENT });
      em.findOne.mockResolvedValueOnce(doc);
      // For the binary copy query
      (qb.getOne as jest.Mock).mockResolvedValueOnce({
        id: DOC_ID,
        file: Buffer.from('original-content'),
      });

      const dto: UpdateDocumentDto = { title: 'Version 2' };
      const result = await service.update(
        DOC_ID,
        dto,
        undefined,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      // Old document marked as SUPERSEDED
      expect(doc.status).toBe(DocumentStatus.SUPERSEDED);
      // Recipients of old doc updated
      expect(em.update).toHaveBeenCalledWith(
        DocumentRecipient,
        { document_id: DOC_ID },
        { status: RecipientStatus.UPDATED },
      );
      // New document saved with incremented version
      expect(result.version).toBe(2);
      expect(result.title).toBe('Version 2');
    });
  });

  // ── update (rejected statuses) ─────────────────────────────────────────────

  describe('update (rejected statuses)', () => {
    it('rejects update on SUPERSEDED document', async () => {
      const doc = makeDocument({ status: DocumentStatus.SUPERSEDED });
      em.findOne.mockResolvedValueOnce(doc);

      await expect(
        service.update(
          DOC_ID,
          {},
          undefined,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects update on VOIDED document', async () => {
      const doc = makeDocument({ status: DocumentStatus.VOIDED });
      em.findOne.mockResolvedValueOnce(doc);

      await expect(
        service.update(
          DOC_ID,
          {},
          undefined,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── update (ownership) ─────────────────────────────────────────────────────

  describe('update (ownership check)', () => {
    it('rejects update by non-owner', async () => {
      const doc = makeDocument({ owner_id: OTHER_USER_ID });
      em.findOne.mockResolvedValueOnce(doc);

      await expect(
        service.update(
          DOC_ID,
          {},
          undefined,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('hard deletes a DRAFT document', async () => {
      const doc = makeDocument({ status: DocumentStatus.DRAFT });
      em.findOne.mockResolvedValueOnce(doc);

      await service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager);
      expect(em.remove).toHaveBeenCalledWith(doc);
    });

    it('soft deletes (voids) a SENT document', async () => {
      const doc = makeDocument({ status: DocumentStatus.SENT });
      em.findOne.mockResolvedValueOnce(doc);

      await service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager);
      expect(doc.status).toBe(DocumentStatus.DELETED);
      expect(em.save).toHaveBeenCalledWith(doc);
    });

    it('hard deletes a SUPERSEDED document with no child versions', async () => {
      const doc = makeDocument({ status: DocumentStatus.SUPERSEDED });
      em.findOne
        .mockResolvedValueOnce(doc) // findOwnedDocument
        .mockResolvedValueOnce(null); // no documents reference this as parent

      await service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager);
      expect(em.remove).toHaveBeenCalledWith(doc);
    });

    it('rejects deleting a SUPERSEDED document that is the root of a version chain', async () => {
      const doc = makeDocument({ status: DocumentStatus.SUPERSEDED });
      const childVersion = makeDocument({
        id: DOC_ID_2,
        parent_document_id: DOC_ID,
        version: 2,
      });
      em.findOne
        .mockResolvedValueOnce(doc) // findOwnedDocument
        .mockResolvedValueOnce(childVersion); // version chain found

      await expect(
        service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
      expect(em.remove).not.toHaveBeenCalled();
    });

    it('is idempotent for VOIDED documents', async () => {
      const doc = makeDocument({ status: DocumentStatus.VOIDED });
      em.findOne.mockResolvedValueOnce(doc);

      await service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager);
      expect(em.remove).not.toHaveBeenCalled();
      expect(em.save).not.toHaveBeenCalled();
    });

    it('rejects deletion by non-owner', async () => {
      const doc = makeDocument({ owner_id: OTHER_USER_ID });
      em.findOne.mockResolvedValueOnce(doc);

      await expect(
        service.remove(DOC_ID, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── send ────────────────────────────────────────────────────────────────────

  describe('send', () => {
    it('sends a DRAFT document and creates recipients', async () => {
      const doc = makeDocument({ status: DocumentStatus.DRAFT });
      em.findOne.mockResolvedValueOnce(doc); // findOwnedDocument
      em.find
        .mockResolvedValueOnce([]) // bulk users by email -> none (external recipient)
        .mockResolvedValueOnce([]); // existing recipients -> none

      const dto: SendDocumentDto = {
        recipients: [
          { recipient_email: 'alice@example.com', recipient_name: 'Alice' },
        ],
      };

      const result = await service.send(
        DOC_ID,
        dto,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.status).toBe(DocumentStatus.SENT);
      expect(em.save).toHaveBeenCalledTimes(2); // recipients + document
    });

    it('validates referenced user_id exists', async () => {
      const doc = makeDocument({ status: DocumentStatus.DRAFT });
      em.findOne.mockResolvedValueOnce(doc); // findOwnedDocument
      em.find.mockResolvedValueOnce([]); // bulk users by patient_id -> not found

      const dto: SendDocumentDto = {
        recipients: [
          {
            recipient_email: 'bob@example.com',
            user_id: '11111111-1111-4111-8111-111111111111',
          },
        ],
      };

      await expect(
        service.send(DOC_ID, dto, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects sending a non-DRAFT document', async () => {
      const doc = makeDocument({ status: DocumentStatus.SENT });
      em.findOne.mockResolvedValueOnce(doc);

      const dto: SendDocumentDto = {
        recipients: [{ recipient_email: 'alice@example.com' }],
      };

      await expect(
        service.send(DOC_ID, dto, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate recipient email on the same document', async () => {
      const doc = makeDocument({ status: DocumentStatus.DRAFT });
      const existingRecipient = makeRecipient();
      em.findOne.mockResolvedValueOnce(doc); // findOwnedDocument
      em.find
        .mockResolvedValueOnce([]) // bulk users by email -> none
        .mockResolvedValueOnce([existingRecipient]); // existing recipients -> duplicate found

      const dto: SendDocumentDto = {
        recipients: [{ recipient_email: 'alice@example.com' }],
      };

      await expect(
        service.send(DOC_ID, dto, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects sending by non-owner', async () => {
      const doc = makeDocument({ owner_id: OTHER_USER_ID });
      em.findOne.mockResolvedValueOnce(doc);

      const dto: SendDocumentDto = {
        recipients: [{ recipient_email: 'alice@example.com' }],
      };

      await expect(
        service.send(DOC_ID, dto, OWNER_ID, em as unknown as EntityManager),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applies locks when provided with the document', async () => {
      const doc = makeDocument({ status: DocumentStatus.DRAFT });
      em.findOne.mockResolvedValueOnce(doc);
      em.find
        .mockResolvedValueOnce([]) // bulk users by email
        .mockResolvedValueOnce([]); // existing recipients

      const dto: SendDocumentDto = {
        recipients: [{ recipient_email: 'alice@example.com' }],
        locks: [{ type: 'PASSWORD' as any, password: 'secret123' }],
      };

      await service.send(DOC_ID, dto, OWNER_ID, em as unknown as EntityManager);

      expect(locksService.applyLocks).toHaveBeenCalledWith(
        DOC_ID,
        dto.locks,
        em,
      );
    });
  });

  // ── findAllForUser ──────────────────────────────────────────────────────────

  describe('findAllForUser', () => {
    it('returns owned and received documents without duplicates', async () => {
      const ownedDoc = makeDocument({ id: DOC_ID });
      const receivedDoc = makeDocument({
        id: DOC_ID_2,
        owner_id: OTHER_USER_ID,
      });
      const sharedDoc = makeDocument({ id: DOC_ID }); // same as owned

      em.find
        .mockResolvedValueOnce([ownedDoc]) // owned
        .mockResolvedValueOnce([
          makeRecipient({ document: receivedDoc }),
          makeRecipient({ document: sharedDoc }),
        ]); // received

      const result = await service.findAllForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      // Should deduplicate: only 2 unique documents
      expect(result).toHaveLength(2);
    });
  });

  // ── sent documents dashboard ───────────────────────────────────────────────

  describe('findSentDocumentsForUser', () => {
    it('returns stats and lightweight items for an owner', async () => {
      const sentDoc = makeDocument({ status: DocumentStatus.SENT });
      const completedDoc = makeDocument({
        id: DOC_ID_2,
        status: DocumentStatus.SENT,
      });

      const sentRecipient = makeRecipient({
        id: 'recipient-1',
        document_id: DOC_ID,
        recipient_email: 'alice@example.com',
        signing_status: SigningStatus.PENDING,
      });
      const completedRecipient1 = makeRecipient({
        id: 'recipient-2',
        document_id: DOC_ID_2,
        recipient_email: 'alice@example.com',
        signing_status: SigningStatus.SIGNED,
        signed_at: new Date('2026-01-03T10:00:00.000Z'),
      });
      const completedRecipient2 = makeRecipient({
        id: 'recipient-3',
        document_id: DOC_ID_2,
        recipient_email: 'bob@example.com',
        recipient_name: 'Bob',
        signing_status: SigningStatus.SIGNED,
        signed_at: new Date('2026-01-03T11:00:00.000Z'),
      });

      em.find
        .mockResolvedValueOnce([sentDoc, completedDoc])
        .mockResolvedValueOnce([
          sentRecipient,
          completedRecipient1,
          completedRecipient2,
        ]);

      const result = await service.findSentDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.stats.total_sent).toBe(2);
      expect(result.stats.pending_final_signature).toBe(1);
      expect(result.stats.completed).toBe(1);
      expect(result.stats.unique_recipients).toBe(2);
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: SentDocumentStatus.WAITING }),
          expect.objectContaining({
            status: SentDocumentStatus.COMPLETED,
            final_recipient_name: 'Bob',
          }),
        ]),
      );
    });

    it('returns empty stats and items when owner has no sent documents', async () => {
      em.find.mockResolvedValueOnce([]);

      const result = await service.findSentDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toEqual({
        stats: {
          total_sent: 0,
          pending_final_signature: 0,
          unique_recipients: 0,
          completed: 0,
        },
        items: [],
      });
    });
  });

  describe('findSentDocumentByIdForUser', () => {
    it('returns detailed payload shape for owner', async () => {
      const recipient = makeRecipient({
        signing_status: SigningStatus.SIGNED,
        signed_at: new Date('2026-01-03T12:00:00.000Z'),
      });
      const doc = makeDocument({
        status: DocumentStatus.SENT,
        recipients: [recipient],
      });
      em.findOne.mockResolvedValueOnce(doc);

      const result = await service.findSentDocumentByIdForUser(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: DOC_ID,
          document_name: 'Test Document',
          status: SentDocumentStatus.COMPLETED,
          recipients: [
            expect.objectContaining({
              id: recipient.id,
              signing_status: SigningStatus.SIGNED,
            }),
          ],
        }),
      );
    });

    it('throws NotFoundException when document does not exist', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findSentDocumentByIdForUser(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when document belongs to another owner', async () => {
      em.findOne.mockResolvedValueOnce(
        makeDocument({ owner_id: OTHER_USER_ID, status: DocumentStatus.SENT }),
      );

      await expect(
        service.findSentDocumentByIdForUser(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── received documents dashboard ────────────────────────────────────────────

  describe('findReceivedDocumentsForUser', () => {
    it('returns stats and lightweight items for a recipient', async () => {
      const sender = makeUser();
      const pendingDoc = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
        title: 'NDA ACME',
        file_size: '204800',
        created_at: new Date('2026-06-20T08:50:00.000Z'),
        updated_at: new Date('2026-06-22T09:00:00.000Z'),
      });
      const signedDoc = makeDocument({
        id: DOC_ID_2,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
        title: 'Employment Contract',
        file_size: '1048576',
        created_at: new Date('2026-06-18T10:00:00.000Z'),
        updated_at: new Date('2026-06-21T10:00:00.000Z'),
      });

      const pendingRecipient = makeRecipient({
        document_id: DOC_ID,
        user_id: OWNER_ID,
        sent_at: new Date('2026-06-20T09:00:00.000Z'),
        signing_status: SigningStatus.PENDING,
        signed_at: null,
        document: pendingDoc,
      });
      const signedRecipient = makeRecipient({
        id: 'r2',
        document_id: DOC_ID_2,
        user_id: OWNER_ID,
        sent_at: new Date('2026-06-18T11:00:00.000Z'),
        signing_status: SigningStatus.SIGNED,
        signed_at: new Date('2026-06-21T10:00:00.000Z'),
        document: signedDoc,
      });

      em.find.mockResolvedValueOnce([pendingRecipient, signedRecipient]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.stats.total_received).toBe(2);
      expect(result.stats.pending_my_signature).toBe(1);
      expect(result.stats.signed_by_me).toBe(1);
      expect(result.stats.rejected_or_revoked).toBe(0);
      expect(result.items).toHaveLength(2);

      // PENDING first (by received_at ASC), then signed
      expect(result.items[0].status).toBe('PENDING');
      expect(result.items[0].document_name).toBe('NDA ACME');
      expect(result.items[0].sender_name).toBe('Alice Example');
      expect(result.items[0].sender_email).toBe('alice@example.com');
      expect(result.items[0].expires_at).toBeNull();
      expect(result.items[1].status).toBe('SIGNED');
    });

    it('computes rejected_or_revoked metric correctly', async () => {
      const sender = makeUser();
      const rejectedDoc = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });
      const revokedDoc = makeDocument({
        id: DOC_ID_2,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });

      em.find.mockResolvedValueOnce([
        makeRecipient({
          document_id: DOC_ID,
          user_id: OWNER_ID,
          signing_status: SigningStatus.REJECTED,
          document: rejectedDoc,
        }),
        makeRecipient({
          id: 'r2',
          document_id: DOC_ID_2,
          user_id: OWNER_ID,
          signing_status: SigningStatus.REVOKED,
          document: revokedDoc,
        }),
      ]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.stats.rejected_or_revoked).toBe(2);
    });

    it('maps CANCELLED + PENDING recipient as REVOKED and excludes from pending metric', async () => {
      const sender = makeUser();
      const cancelledDoc = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.CANCELLED,
      });
      const sentPendingDoc = makeDocument({
        id: DOC_ID_2,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });

      em.find.mockResolvedValueOnce([
        makeRecipient({
          document_id: DOC_ID,
          user_id: OWNER_ID,
          signing_status: SigningStatus.PENDING,
          document: cancelledDoc,
        }),
        makeRecipient({
          id: 'r2',
          document_id: DOC_ID_2,
          user_id: OWNER_ID,
          signing_status: SigningStatus.PENDING,
          document: sentPendingDoc,
        }),
      ]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.stats.total_received).toBe(2);
      expect(result.stats.pending_my_signature).toBe(1);
      expect(result.stats.rejected_or_revoked).toBe(1);
      expect(result.items.find((item) => item.id === DOC_ID)?.status).toBe(
        'REVOKED',
      );
      expect(result.items.find((item) => item.id === DOC_ID_2)?.status).toBe(
        'PENDING',
      );
    });

    it('filters out non-SENT documents', async () => {
      const sender = makeUser();
      const voidedDoc = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.VOIDED,
      });

      em.find.mockResolvedValueOnce([
        makeRecipient({
          document_id: DOC_ID,
          user_id: OWNER_ID,
          document: voidedDoc,
        }),
      ]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.stats.total_received).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('returns empty stats and items when user has no received documents', async () => {
      em.find.mockResolvedValueOnce([]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toEqual({
        stats: {
          total_received: 0,
          pending_my_signature: 0,
          signed_by_me: 0,
          rejected_or_revoked: 0,
        },
        items: [],
      });
    });

    it('sorts PENDING first (asc by received_at), non-PENDING desc by signed_at', async () => {
      const sender = makeUser();
      const now = new Date('2026-06-22');
      const yesterday = new Date('2026-06-21');
      const twoDaysAgo = new Date('2026-06-20');

      const doc1 = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });
      const doc2 = makeDocument({
        id: DOC_ID_2,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });
      const doc3 = makeDocument({
        id: 'doc3',
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
      });

      em.find.mockResolvedValueOnce([
        makeRecipient({
          document_id: DOC_ID,
          user_id: OWNER_ID,
          sent_at: yesterday,
          signing_status: SigningStatus.SIGNED,
          signed_at: now,
          document: doc1,
        }),
        makeRecipient({
          id: 'r2',
          document_id: DOC_ID_2,
          user_id: OWNER_ID,
          sent_at: twoDaysAgo,
          signing_status: SigningStatus.PENDING,
          document: doc2,
        }),
        makeRecipient({
          id: 'r3',
          document_id: 'doc3',
          user_id: OWNER_ID,
          sent_at: now,
          signing_status: SigningStatus.PENDING,
          document: doc3,
        }),
      ]);

      const result = await service.findReceivedDocumentsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.items[0].id).toBe(DOC_ID_2);
      expect(result.items[1].id).toBe('doc3');
      expect(result.items[2].id).toBe(DOC_ID);
    });
  });

  describe('findReceivedDocumentByIdForUser', () => {
    it('returns detailed payload shape for a recipient', async () => {
      const sender = makeUser();
      const now = new Date('2026-06-20T09:00:00.000Z');
      const recipient = makeRecipient({
        document_id: DOC_ID,
        user_id: OWNER_ID,
        sent_at: now,
        signing_status: SigningStatus.PENDING,
        signed_at: null,
      });
      const doc = makeDocument({
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.SENT,
        recipients: [recipient],
        created_at: new Date('2026-06-20T08:50:00.000Z'),
        updated_at: now,
      });
      recipient.document = doc;

      em.findOne.mockResolvedValueOnce(recipient);

      const result = await service.findReceivedDocumentByIdForUser(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.id).toBe(DOC_ID);
      expect(result.document_name).toBe('Test Document');
      expect(result.status).toBe('PENDING');
      expect(result.sender.name).toBe('Alice Example');
      expect(result.sender.email).toBe('alice@example.com');
      expect(result.my_recipient.id).toBe(recipient.id);
      expect(result.my_recipient.signing_status).toBe('PENDING');
      expect(result.my_recipient.rejected_at).toBeNull();
      expect(result.my_recipient.revoked_at).toBeNull();
    });

    it('throws NotFoundException when recipient record not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findReceivedDocumentByIdForUser(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when document status is not SENT', async () => {
      const doc = makeDocument({ status: DocumentStatus.VOIDED });
      const recipient = makeRecipient({ document: doc });
      em.findOne.mockResolvedValueOnce(recipient);

      await expect(
        service.findReceivedDocumentByIdForUser(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps CANCELLED + PENDING recipient as REVOKED in detail', async () => {
      const sender = makeUser();
      const recipient = makeRecipient({
        document_id: DOC_ID,
        user_id: OWNER_ID,
        signing_status: SigningStatus.PENDING,
      });
      const doc = makeDocument({
        id: DOC_ID,
        owner_id: OTHER_USER_ID,
        owner: sender,
        status: DocumentStatus.CANCELLED,
        recipients: [recipient],
      });
      recipient.document = doc;

      em.findOne.mockResolvedValueOnce(recipient);

      const result = await service.findReceivedDocumentByIdForUser(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.status).toBe('REVOKED');
      expect(result.my_recipient.signing_status).toBe('REVOKED');
    });
  });

  describe('getReceivedRecipientPublicLinkId', () => {
    it('returns the public link id for a valid recipient', async () => {
      em.findOne.mockResolvedValueOnce({ public_link_id: 'pub-123' });

      const result = await service.getReceivedRecipientPublicLinkId(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result).toBe('pub-123');
    });

    it('throws NotFoundException when recipient not found', async () => {
      em.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getReceivedRecipientPublicLinkId(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns null when public_link_id is null', async () => {
      em.findOne.mockResolvedValueOnce({ public_link_id: null });

      await expect(
        service.getReceivedRecipientPublicLinkId(
          DOC_ID,
          OWNER_ID,
          em as unknown as EntityManager,
        ),
      ).resolves.toBeNull();
    });
  });

  // ── download ────────────────────────────────────────────────────────────────

  describe('download', () => {
    it('returns the binary payload for an authorized user', async () => {
      const doc = makeDocument();
      em.findOne.mockResolvedValueOnce(doc); // findById access check

      const downloadResult = {
        id: DOC_ID,
        file: Buffer.from('pdf-content'),
        mime_type: 'application/pdf',
        original_filename: 'contract.pdf',
      };
      (qb.getOne as jest.Mock).mockResolvedValueOnce(downloadResult);

      const result = await service.download(
        DOC_ID,
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.file).toEqual(Buffer.from('pdf-content'));
      expect(result.mime_type).toBe('application/pdf');
    });

    it('blocks a recipient that has unresolved locks', async () => {
      const recipient = makeRecipient();
      const doc = makeDocument({
        owner_id: OTHER_USER_ID,
        recipients: [recipient],
      });
      em.findOne.mockResolvedValueOnce(doc); // findById (loads document with recipients)
      locksService.hasUnresolvedLocks.mockResolvedValue(true);

      await expect(
        service.download(
          DOC_ID,
          recipient.user_id!,
          em as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a recipient that has resolved all locks', async () => {
      const recipient = makeRecipient();
      const doc = makeDocument({
        owner_id: OTHER_USER_ID,
        recipients: [recipient],
      });
      em.findOne.mockResolvedValueOnce(doc); // findById (loads document with recipients)
      locksService.hasUnresolvedLocks.mockResolvedValue(false);

      const downloadResult = {
        id: DOC_ID,
        file: Buffer.from('pdf-content'),
        mime_type: 'application/pdf',
        original_filename: 'contract.pdf',
      };
      (qb.getOne as jest.Mock).mockResolvedValueOnce(downloadResult);

      const result = await service.download(
        DOC_ID,
        recipient.user_id!,
        em as unknown as EntityManager,
      );

      expect(result.file).toBeDefined();
    });
  });

  // ── findSentForUser ─────────────────────────────────────────────────────────

  describe('findSentForUser', () => {
    it('loads documents with recipients and owner relations', async () => {
      const doc = makeDocument();
      em.find.mockResolvedValueOnce([doc]);

      await service.findSentForUser(OWNER_ID, em as unknown as EntityManager);

      expect(em.find).toHaveBeenCalledWith(Document, {
        where: { owner_id: OWNER_ID },
        relations: ['recipients', 'owner'],
        order: { created_at: 'DESC' },
      });
    });
  });

  // ── findReceivedForUser ─────────────────────────────────────────────────────

  describe('findReceivedForUser', () => {
    it('loads recipients with document.owner and document.recipients relations', async () => {
      const recipient = makeRecipient({
        document: makeDocument({ id: DOC_ID_2, owner_id: OTHER_USER_ID }),
      });
      em.find.mockResolvedValueOnce([recipient]);

      await service.findReceivedForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(em.find).toHaveBeenCalledWith(DocumentRecipient, {
        where: { user_id: OWNER_ID },
        relations: ['document.owner', 'document.recipients'],
      });
    });
  });

  // ── findSentRecipientsForUser ────────────────────────────────────────────────

  describe('findSentRecipientsForUser', () => {
    it('returns one row per recipient for the owner', async () => {
      const recipient1 = makeRecipient({
        id: 'recipient-1',
        document_id: DOC_ID,
        signing_status: SigningStatus.PENDING,
        sent_at: new Date('2026-06-20T09:00:00.000Z'),
      });
      const recipient2 = makeRecipient({
        id: 'recipient-2',
        document_id: DOC_ID_2,
        signing_status: SigningStatus.SIGNED,
        signed_at: new Date('2026-06-21T10:00:00.000Z'),
        sent_at: new Date('2026-06-21T09:00:00.000Z'),
      });

      const doc1 = makeDocument({ id: DOC_ID, title: 'Doc One' });
      const doc2 = makeDocument({
        id: DOC_ID_2,
        title: 'Doc Two',
      });

      recipient1.document = doc1;
      recipient2.document = doc2;

      (qb.getMany as jest.Mock).mockResolvedValueOnce([recipient2, recipient1]);

      const result = await service.findSentRecipientsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].document_id).toBe(DOC_ID_2);
      expect(result.items[0].signing_status).toBe(SigningStatus.SIGNED);
      expect(result.items[0].signed_at).toBe('2026-06-21T10:00:00.000Z');
      expect(result.items[0].document_name).toBe('Doc Two');
      expect(result.items[1].recipient_email).toBe('alice@example.com');
      expect(result.items[1].signing_status).toBe(SigningStatus.PENDING);
      expect(result.items[1].signed_at).toBeNull();

      expect(result.stats.total).toBe(2);
      expect(result.stats.pending).toBe(1);
      expect(result.stats.signed).toBe(1);
      expect(result.stats.rejected).toBe(0);
      expect(result.stats.revoked).toBe(0);

      expect(em.createQueryBuilder).toHaveBeenCalledWith(
        DocumentRecipient,
        'dr',
      );
      expect(qb.innerJoinAndSelect).toHaveBeenCalledWith('dr.document', 'doc');
      expect(qb.where).toHaveBeenCalledWith('doc.owner_id = :userId', {
        userId: OWNER_ID,
      });
    });

    it('excludes DRAFT documents', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      await service.findSentRecipientsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'doc.status IN (:...activeStatuses)',
        {
          activeStatuses: expect.arrayContaining([
            DocumentStatus.SENT,
            DocumentStatus.SUPERSEDED,
            DocumentStatus.VOIDED,
          ]),
        },
      );
    });

    it('returns empty array when no sent documents', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findSentRecipientsForUser(
        OWNER_ID,
        em as unknown as EntityManager,
      );

      expect(result.items).toEqual([]);
      expect(result.stats).toEqual({
        total: 0,
        pending: 0,
        signed: 0,
        rejected: 0,
        revoked: 0,
      });
    });

    it('filters by owner_id so other users documents are excluded', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      await service.findSentRecipientsForUser(
        OTHER_USER_ID,
        em as unknown as EntityManager,
      );

      expect(qb.where).toHaveBeenCalledWith('doc.owner_id = :userId', {
        userId: OTHER_USER_ID,
      });
    });

    it('uses the default entityManager when no em is passed', async () => {
      (qb.getMany as jest.Mock).mockResolvedValueOnce([]);

      await service.findSentRecipientsForUser(OWNER_ID);

      expect(em.createQueryBuilder).toHaveBeenCalled();
    });
  });

  // ── recordAccess ────────────────────────────────────────────────────────────

  describe('recordAccess', () => {
    const RECIPIENT_ID = 'rec-abc';

    it('builds an UPDATE query with COALESCE for first_accessed_at on DocumentRecipient', async () => {
      await service.recordAccess(RECIPIENT_ID, em as unknown as EntityManager);

      expect(em.createQueryBuilder).toHaveBeenCalled();
      expect(qb.update).toHaveBeenCalledWith(DocumentRecipient);
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          first_accessed_at: expect.any(Function),
          last_accessed_at: expect.any(Function),
        }),
      );
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id: RECIPIENT_ID });
      expect(qb.execute).toHaveBeenCalled();
    });

    it('uses the default entityManager when no em is passed', async () => {
      await service.recordAccess(RECIPIENT_ID);

      expect(em.createQueryBuilder).toHaveBeenCalled();
    });
  });

  // ── findTimelineForUser ───────────────────────────────────────────────────

  describe('findTimelineForUser', () => {
    const NOW = '2026-07-02T14:00:00.000Z';
    const EARLIER = '2026-07-01T09:00:00.000Z';
    const EARLIEST = '2026-06-30T08:00:00.000Z';

    function makeTimelineRow(
      overrides: Partial<TimelineEventRow> = {},
    ): TimelineEventRow {
      return {
        event_id: 'evt-uuid',
        document_id: DOC_ID,
        document_name: 'Test Document',
        action: DocumentSigningEventAction.SIGNED,
        occurred_at: NOW,
        direction: 'sent',
        other_party_name: 'Alice',
        other_party_email: 'alice@example.com',
        ...overrides,
      };
    }

    it('returns events in the order returned by the query', async () => {
      const rows: TimelineEventRow[] = [
        makeTimelineRow({
          event_id: 'evt-2',
          occurred_at: NOW,
        }),
        makeTimelineRow({
          event_id: 'evt-1',
          occurred_at: EARLIER,
        }),
        makeTimelineRow({
          event_id: 'evt-3',
          occurred_at: EARLIEST,
        }),
      ];
      em.query.mockResolvedValueOnce(rows);

      const result = await service.findTimelineForUser(OWNER_ID);

      expect(em.query).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
      // Sorting is handled by SQL ORDER BY — mock returns pre-sorted rows
      expect(result[0].event_id).toBe('evt-2');
      expect(result[1].event_id).toBe('evt-1');
      expect(result[2].event_id).toBe('evt-3');
      // Verify query includes ORDER BY occurred_at DESC
      expect(em.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY occurred_at DESC'),
        [OWNER_ID, OWNER_ID],
      );
    });

    it('returns empty array for user with no events', async () => {
      em.query.mockResolvedValueOnce([]);

      const result = await service.findTimelineForUser(OWNER_ID);

      expect(result).toEqual([]);
      expect(em.query).toHaveBeenCalledTimes(1);
    });

    it('direction is "sent" when user owns the document', async () => {
      const rows = [
        makeTimelineRow({
          event_id: 'evt-sent',
          direction: 'sent',
          other_party_name: 'Bob Recipient',
          other_party_email: 'bob@example.com',
        }),
      ];
      em.query.mockResolvedValueOnce(rows);

      const result = await service.findTimelineForUser(OWNER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('sent');
      expect(result[0].other_party_name).toBe('Bob Recipient');
      expect(result[0].other_party_email).toBe('bob@example.com');
    });

    it('direction is "received" when user is recipient but not owner', async () => {
      const rows = [
        makeTimelineRow({
          event_id: 'evt-received',
          direction: 'received',
          other_party_name: 'Alice Owner',
          other_party_email: 'alice-owner@example.com',
        }),
      ];
      em.query.mockResolvedValueOnce(rows);

      const result = await service.findTimelineForUser(OWNER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('received');
      expect(result[0].other_party_name).toBe('Alice Owner');
      expect(result[0].other_party_email).toBe('alice-owner@example.com');
    });

    it('self-recipient: event appears once with direction "sent"', async () => {
      const rows = [
        makeTimelineRow({
          event_id: 'evt-self',
          direction: 'sent',
        }),
      ];
      em.query.mockResolvedValueOnce(rows);

      const result = await service.findTimelineForUser(OWNER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('sent');
      // No duplicate event — the UNION query excludes self-recipient duplicate
      expect(result[0].event_id).toBe('evt-self');
    });

    it('includes LIMIT 200 in the query', async () => {
      em.query.mockResolvedValueOnce([]);

      await service.findTimelineForUser(OWNER_ID);

      expect(em.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 200'),
        [OWNER_ID, OWNER_ID],
      );
    });
  });
});
