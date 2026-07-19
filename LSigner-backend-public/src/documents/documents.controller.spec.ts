import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { EmailService } from '../email/email.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocksService } from '../locks/locks.service';
import { Document, DocumentStatus } from '../entities/document.entity';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { User } from '../entities/user.entity';
import { LockType } from '../entities/document-lock.entity';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import { DocumentSigningService } from '../document-signing/document-signing.service';
import {
  DocumentRecipient,
  RecipientStatus,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { DocumentSigningEventAction } from '../entities/document-signing-event.entity';
import { TimelineEventRow } from './dto/timeline.dto';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const DOC_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';

const JWT_PAYLOAD: JwtPayload = {
  sub: OWNER_ID,
  email: 'owner@example.com',
};

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: DOC_ID,
    owner_id: OWNER_ID,
    title: 'Test Document',
    description: null,
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
  };
}

function makeDocumentRecipient(
  overrides: Partial<DocumentRecipient> = {},
): DocumentRecipient {
  return {
    id: 'recipient-uuid',
    document_id: DOC_ID,
    user_id: null,
    recipient_email: 'alice@example.com',
    recipient_name: 'Alice',
    public_link_id: null,
    status: RecipientStatus.PENDING,
    signing_status: SigningStatus.PENDING,
    sent_at: new Date('2026-01-01T10:00:00.000Z'),
    first_accessed_at: null,
    last_accessed_at: null,
    signed_at: null,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-01T10:00:00.000Z'),
    document: {} as Document,
    user: null,
    signing_events: [],
    signed_artifact: null,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsService: {
    create: jest.Mock;
    findById: jest.Mock;
    findAllForUser: jest.Mock;
    findSentForUser: jest.Mock;
    findSentDocumentByIdForUser: jest.Mock;
    findReceivedForUser: jest.Mock;
    findReceivedDocumentByIdForUser: jest.Mock;
    getReceivedRecipientPublicLinkId: jest.Mock;
    download: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    send: jest.Mock;
    sendSentDocumentReminder: jest.Mock;
    recordAccess: jest.Mock;
    findTimelineForUser: jest.Mock;
  };
  let locksService: {
    getLocksForDocument: jest.Mock;
    getLocksOverview: jest.Mock;
    resolveLock: jest.Mock;
  };
  let emailService: {
    sendWelcomeEmail: jest.Mock;
    sendDocumentNotification: jest.Mock;
    sendReminder: jest.Mock;
    sendUnshared: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let documentSigningService: {
    revokeRecipientByOwner: jest.Mock;
    rejectByRecipientUserId: jest.Mock;
  };
  let entityManager: { transaction: jest.Mock };

  beforeEach(async () => {
    documentsService = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllForUser: jest.fn(),
      findSentForUser: jest.fn(),
      findSentDocumentByIdForUser: jest.fn(),
      findReceivedForUser: jest.fn(),
      findReceivedDocumentByIdForUser: jest.fn(),
      getReceivedRecipientPublicLinkId: jest.fn(),
      download: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      send: jest.fn(),
      sendSentDocumentReminder: jest.fn(),
      recordAccess: jest.fn(),
      findTimelineForUser: jest.fn(),
    };

    locksService = {
      getLocksForDocument: jest.fn(),
      getLocksOverview: jest.fn(),
      resolveLock: jest.fn(),
    };

    emailService = {
      sendWelcomeEmail: jest.fn(),
      sendDocumentNotification: jest.fn(),
      sendReminder: jest.fn().mockResolvedValue(undefined),
      sendUnshared: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'app.port') return 3000;
        return ['http://localhost:3001'];
      }),
    };

    documentSigningService = {
      revokeRecipientByOwner: jest.fn(),
      rejectByRecipientUserId: jest.fn(),
    };

    // Mock entityManager.transaction to just call the callback with the service
    entityManager = {
      transaction: jest
        .fn()
        .mockImplementation((cb: (em: EntityManager) => Promise<unknown>) =>
          cb(entityManager as unknown as EntityManager),
        ),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documentsService },
        { provide: LocksService, useValue: locksService },
        { provide: DocumentSigningService, useValue: documentSigningService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
        { provide: EntityManager, useValue: entityManager },
      ],
    }).compile();

    controller = module.get(DocumentsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAllForUser with the authenticated user id', async () => {
      const docs = [makeDocument()];
      documentsService.findAllForUser.mockResolvedValueOnce(docs);

      const result = await controller.findAll(JWT_PAYLOAD);

      expect(result).toEqual({ items: docs });
      expect(documentsService.findAllForUser).toHaveBeenCalledWith(
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('findSent', () => {
    it('delegates to service.findSentForUser and wraps items with toSentListItem', async () => {
      const doc = makeDocument();
      documentsService.findSentForUser.mockResolvedValueOnce([doc]);

      const result = await controller.findSent(JWT_PAYLOAD);

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(documentsService.findSentForUser).toHaveBeenCalledWith(
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('findSentById', () => {
    it('delegates to service.findSentDocumentByIdForUser', async () => {
      const response = {
        id: DOC_ID,
        document_name: 'Test Document',
      };
      documentsService.findSentDocumentByIdForUser.mockResolvedValueOnce(
        response,
      );

      const result = await controller.findSentById(DOC_ID, JWT_PAYLOAD);

      expect(result).toEqual(response);
      expect(documentsService.findSentDocumentByIdForUser).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('findReceived', () => {
    it('delegates to service.findReceivedForUser and wraps items with toReceivedListItem', async () => {
      const doc = makeDocument({
        recipients: [makeDocumentRecipient({ user_id: OWNER_ID })],
      });
      documentsService.findReceivedForUser.mockResolvedValueOnce([doc]);

      const result = await controller.findReceived(JWT_PAYLOAD);

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(documentsService.findReceivedForUser).toHaveBeenCalledWith(
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('findReceivedById', () => {
    it('delegates to service.findReceivedDocumentByIdForUser', async () => {
      const response = {
        id: DOC_ID,
        document_name: 'Test Document',
        status: 'PENDING',
      };
      documentsService.findReceivedDocumentByIdForUser.mockResolvedValueOnce(
        response,
      );

      const result = await controller.findReceivedById(DOC_ID, JWT_PAYLOAD);

      expect(result).toEqual(response);
      expect(
        documentsService.findReceivedDocumentByIdForUser,
      ).toHaveBeenCalledWith(DOC_ID, OWNER_ID, entityManager);
    });
  });

  describe('getReceivedViewUrl', () => {
    it('delegates to service.getReceivedRecipientPublicLinkId and builds url', async () => {
      documentsService.getReceivedRecipientPublicLinkId.mockResolvedValueOnce(
        'abc123',
      );

      const result = await controller.getReceivedViewUrl(DOC_ID, JWT_PAYLOAD);

      expect(result).toEqual({
        url: 'http://localhost:3001/public/abc123',
      });
      expect(
        documentsService.getReceivedRecipientPublicLinkId,
      ).toHaveBeenCalledWith(DOC_ID, OWNER_ID, entityManager);
    });
  });

  describe('rejectReceivedDocument', () => {
    it('delegates to documentSigningService.rejectByRecipientUserId', async () => {
      const response = {
        id: DOC_ID,
        status: 'REJECTED',
        rejected_at: '2026-06-22T09:00:00.000Z',
      };
      documentSigningService.rejectByRecipientUserId.mockResolvedValueOnce(
        response,
      );

      const dto = { reason: 'Not agreed' };
      const req = { ip: '127.0.0.1', get: jest.fn().mockReturnValue('jest') };

      const result = await controller.rejectReceivedDocument(
        DOC_ID,
        dto,
        JWT_PAYLOAD,
        req as import('express').Request,
      );

      expect(result).toEqual(response);
      expect(
        documentSigningService.rejectByRecipientUserId,
      ).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        dto,
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager,
      );
    });
  });

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      const doc = makeDocument();
      documentsService.findById.mockResolvedValueOnce(doc);

      const result = await controller.findOne(DOC_ID, JWT_PAYLOAD);

      expect(result).toEqual(doc);
      expect(documentsService.findById).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create with file and dto', async () => {
      const doc = makeDocument();
      documentsService.create.mockResolvedValueOnce(doc);
      const file = { originalname: 'test.pdf' } as Express.Multer.File;

      const result = await controller.create(
        file,
        { title: 'Test' },
        JWT_PAYLOAD,
      );

      expect(result).toEqual(doc);
      expect(documentsService.create).toHaveBeenCalledWith(
        { title: 'Test' },
        file,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      documentsService.remove.mockResolvedValueOnce(undefined);

      await controller.remove(DOC_ID, JWT_PAYLOAD);

      expect(documentsService.remove).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('sendReminder', () => {
    it('delegates to service and fires reminder email after transaction', async () => {
      const recipientId = 'e2f6b9da-827f-42d0-bd40-5fc6efbce2fe';
      const reminderContext = {
        recipientEmail: 'alice@example.com',
        recipientName: 'Alice',
        documentName: 'Test Document',
        senderName: 'John Doe',
        recipientPublicLinkId: null,
        documentId: DOC_ID,
      };
      documentsService.sendSentDocumentReminder.mockResolvedValueOnce(
        reminderContext,
      );

      await controller.sendReminder(DOC_ID, recipientId, JWT_PAYLOAD);

      expect(documentsService.sendSentDocumentReminder).toHaveBeenCalledWith(
        DOC_ID,
        recipientId,
        OWNER_ID,
        entityManager,
      );
      expect(emailService.sendReminder).toHaveBeenCalledWith(
        'alice@example.com',
        'Test Document',
        'John Doe',
        'Alice',
        `http://localhost:3001/documents/received/${DOC_ID}`,
      );
    });
  });

  describe('deleteRecipientSharedAccess', () => {
    it('fires sendUnshared email after successful revocation', async () => {
      const recipientId = 'e2f6b9da-827f-42d0-bd40-5fc6efbce2fe';
      const unsharedContext = {
        recipientEmail: 'alice@example.com',
        recipientName: 'Alice',
        documentName: 'Test Document',
        senderName: 'John Doe',
      };
      documentSigningService.revokeRecipientByOwner.mockResolvedValueOnce(
        unsharedContext,
      );

      await controller.deleteRecipientSharedAccess(
        DOC_ID,
        recipientId,
        JWT_PAYLOAD,
      );

      expect(
        documentSigningService.revokeRecipientByOwner,
      ).toHaveBeenCalledWith(DOC_ID, recipientId, OWNER_ID, {}, entityManager);
      expect(emailService.sendUnshared).toHaveBeenCalledWith(
        'alice@example.com',
        'Test Document',
        'John Doe',
        'Alice',
      );
    });
  });

  describe('send', () => {
    it('delegates to service.send and sends email notifications to recipients', async () => {
      const recipient = makeDocumentRecipient();
      const doc = makeDocument({
        status: DocumentStatus.SENT,
        recipients: [recipient],
      });
      documentsService.send.mockResolvedValueOnce(doc);
      (entityManager.findOne as jest.Mock).mockResolvedValueOnce({
        name: 'John',
        last_name: 'Doe',
      });

      const dto = {
        recipients: [{ recipient_email: 'alice@example.com' }],
      };

      const result = await controller.send(DOC_ID, dto, JWT_PAYLOAD);

      expect(result).toEqual(doc);
      expect(documentsService.send).toHaveBeenCalledWith(
        DOC_ID,
        dto,
        OWNER_ID,
        entityManager,
      );
      expect(emailService.sendDocumentNotification).toHaveBeenCalledWith(
        'alice@example.com',
        {
          recipientName: 'Alice',
          senderName: 'John Doe',
          documentName: 'Test Document',
          documentLink: `http://localhost:3001/documents/received/${DOC_ID}`,
        },
      );
    });
  });

  describe('downloadFile', () => {
    function makeDownloadPayload(
      overrides: { original_filename?: string; mime_type?: string } = {},
    ) {
      return {
        id: DOC_ID,
        file: Buffer.from('pdf-bytes'),
        mime_type: overrides.mime_type ?? 'application/pdf',
        original_filename: overrides.original_filename ?? 'contract.pdf',
      };
    }

    function makeRes() {
      return {
        set: jest.fn(),
        send: jest.fn(),
      };
    }

    it('delegates to service.download with the authenticated user id', async () => {
      const docAccess = makeDocument({ owner_id: OWNER_ID });
      documentsService.findById.mockResolvedValueOnce(docAccess);
      const payload = makeDownloadPayload();
      documentsService.download.mockResolvedValueOnce(payload);
      const res = makeRes();

      await controller.downloadFile(DOC_ID, JWT_PAYLOAD, res as never);

      expect(documentsService.findById).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
      expect(documentsService.download).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });

    it('sets Content-Type and Content-Disposition response headers', async () => {
      const docAccess = makeDocument({ owner_id: OWNER_ID });
      documentsService.findById.mockResolvedValueOnce(docAccess);
      const payload = makeDownloadPayload({
        mime_type: 'application/pdf',
        original_filename: 'my contract.pdf',
      });
      documentsService.download.mockResolvedValueOnce(payload);
      const res = makeRes();

      await controller.downloadFile(DOC_ID, JWT_PAYLOAD, res as never);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent('my contract.pdf')}"`,
      });
    });

    it('sends the file buffer as response body', async () => {
      const docAccess = makeDocument({ owner_id: OWNER_ID });
      documentsService.findById.mockResolvedValueOnce(docAccess);
      const fileBuffer = Buffer.from('binary-content');
      const payload = makeDownloadPayload();
      payload.file = fileBuffer;
      documentsService.download.mockResolvedValueOnce(payload);
      const res = makeRes();

      await controller.downloadFile(DOC_ID, JWT_PAYLOAD, res as never);

      expect(res.send).toHaveBeenCalledWith(fileBuffer);
    });
  });

  describe('update', () => {
    const dto: UpdateDocumentDto = { title: 'Updated title' };

    it('delegates to service.update without a file', async () => {
      const doc = makeDocument({ title: 'Updated title' });
      documentsService.update.mockResolvedValueOnce(doc);

      const result = await controller.update(
        DOC_ID,
        undefined,
        dto,
        JWT_PAYLOAD,
      );

      expect(result).toEqual(doc);
      expect(documentsService.update).toHaveBeenCalledWith(
        DOC_ID,
        dto,
        undefined,
        OWNER_ID,
        entityManager,
      );
    });

    it('delegates to service.update with an uploaded file', async () => {
      const doc = makeDocument({ title: 'Updated title' });
      documentsService.update.mockResolvedValueOnce(doc);
      const file = {
        originalname: 'new-version.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('bytes'),
        size: 5,
      } as Express.Multer.File;

      const result = await controller.update(DOC_ID, file, dto, JWT_PAYLOAD);

      expect(result).toEqual(doc);
      expect(documentsService.update).toHaveBeenCalledWith(
        DOC_ID,
        dto,
        file,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('getLocksOverview', () => {
    it('delegates to locksService.getLocksOverview with the authenticated user id', async () => {
      const overview = [
        {
          id: 'lock-uuid-1',
          lock_type: LockType.PASSWORD,
          recipients: [
            {
              recipient_id: 'recipient-uuid-1',
              recipient_email: 'alice@example.com',
              recipient_name: 'Alice',
              is_resolved: true,
              resolved_at: new Date('2026-04-27T10:00:00.000Z'),
            },
            {
              recipient_id: 'recipient-uuid-2',
              recipient_email: 'bob@example.com',
              recipient_name: null,
              is_resolved: false,
              resolved_at: null,
            },
          ],
        },
      ];
      locksService.getLocksOverview.mockResolvedValueOnce(overview);

      const result = await controller.getLocksOverview(DOC_ID, JWT_PAYLOAD);

      expect(result).toEqual(overview);
      expect(locksService.getLocksOverview).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('getReceivedDocumentLocks', () => {
    it('delegates to locksService.getLocksForDocument with authenticated user', async () => {
      const lockStatus = [
        {
          id: 'lock-uuid-1',
          lock_type: LockType.PASSWORD,
          is_resolved: false,
          resolved_at: null,
        },
      ];
      locksService.getLocksForDocument.mockResolvedValueOnce(lockStatus);

      const result = await controller.getReceivedDocumentLocks(
        DOC_ID,
        JWT_PAYLOAD,
      );

      expect(result).toEqual(lockStatus);
      expect(locksService.getLocksForDocument).toHaveBeenCalledWith(
        DOC_ID,
        OWNER_ID,
        entityManager,
      );
    });
  });

  describe('resolveLock', () => {
    it('delegates to locksService.resolveLock with authenticated user', async () => {
      const lockId = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
      const dto = { password: 'secret123' };

      await controller.resolveLock(DOC_ID, lockId, dto, JWT_PAYLOAD);

      expect(locksService.resolveLock).toHaveBeenCalledWith(
        lockId,
        DOC_ID,
        OWNER_ID,
        dto,
        entityManager,
      );
    });
  });

  describe('GET /documents/timeline', () => {
    const timelineRows: TimelineEventRow[] = [
      {
        event_id: 'evt-003',
        document_id: DOC_ID,
        document_name: 'Test Document',
        action: DocumentSigningEventAction.SIGNED,
        occurred_at: '2026-07-02T14:00:00.000Z',
        direction: 'sent',
        other_party_name: 'Bob Recipient',
        other_party_email: 'bob@example.com',
      },
      {
        event_id: 'evt-002',
        document_id: 'd6ee412b-1bc2-6111-2245-dfh7h9876335',
        document_name: 'NDA',
        action: DocumentSigningEventAction.REJECTED,
        occurred_at: '2026-07-01T09:00:00.000Z',
        direction: 'received',
        other_party_name: 'Alice Owner',
        other_party_email: 'alice@example.com',
      },
    ];

    it('returns 200 with mapped TimelineResponseDto', async () => {
      documentsService.findTimelineForUser.mockResolvedValueOnce(timelineRows);

      const result = await controller.getTimeline(JWT_PAYLOAD);

      expect(result).toEqual({
        items: [
          {
            event_id: 'evt-003',
            document_id: DOC_ID,
            document_name: 'Test Document',
            action: DocumentSigningEventAction.SIGNED,
            occurred_at: '2026-07-02T14:00:00.000Z',
            direction: 'sent',
            other_party_name: 'Bob Recipient',
            other_party_email: 'bob@example.com',
          },
          {
            event_id: 'evt-002',
            document_id: 'd6ee412b-1bc2-6111-2245-dfh7h9876335',
            document_name: 'NDA',
            action: DocumentSigningEventAction.REJECTED,
            occurred_at: '2026-07-01T09:00:00.000Z',
            direction: 'received',
            other_party_name: 'Alice Owner',
            other_party_email: 'alice@example.com',
          },
        ],
      });
      expect(documentsService.findTimelineForUser).toHaveBeenCalledWith(
        OWNER_ID,
        expect.any(Object),
      );
    });

    it('returns 200 with empty items when no events', async () => {
      documentsService.findTimelineForUser.mockResolvedValueOnce([]);

      const result = await controller.getTimeline(JWT_PAYLOAD);

      expect(result).toEqual({ items: [] });
    });
  });
});
