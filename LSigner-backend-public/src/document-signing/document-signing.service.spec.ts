import {
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import * as crypto from 'crypto';
import { DocumentSigningService } from './document-signing.service';
import { LocksService } from '../locks/locks.service';
import { EmailService } from '../email/email.service';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  RecipientStatus,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { User } from '../entities/user.entity';
import { VerificationMethod } from './dto/verification-method.enum';

const ACCESS_TOKEN = 'a'.repeat(64);
const DOC_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';
const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const RECIPIENT_ID = 'bb4ef8d8-1302-44bb-8f5d-d0822710c431';

// Generate real Ed25519 keys for testing
const { privateKey: testPrivateKey, publicKey: testPublicKey } =
  crypto.generateKeyPairSync('ed25519');
const testFingerprint = crypto
  .createHash('sha256')
  .update(testPublicKey.export({ type: 'spki', format: 'der' }))
  .digest('hex');

const mockSigningConfig = {
  privateKey: testPrivateKey,
  publicKey: testPublicKey,
  fingerprint: testFingerprint,
  keyVersion: 1,
};

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: DOC_ID,
    owner_id: OWNER_ID,
    title: 'Employment Contract',
    description: null,
    file: Buffer.from('file-content'),
    file_hash:
      'e7d7bbcf32e085f6f9e5f87f4a43f6b7f34f4d080c7c5ebf0e89b58f4fbc188f',
    original_filename: 'contract.pdf',
    mime_type: 'application/pdf',
    file_size: '1024',
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    parent_document: null,
    recipients: [],
    locks: [],
    owner: {} as User,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeRecipient(
  overrides: Partial<DocumentRecipient> = {},
): DocumentRecipient {
  return {
    id: RECIPIENT_ID,
    document_id: DOC_ID,
    user_id: null,
    recipient_email: 'recipient@example.com',
    recipient_name: 'Alice',
    public_link_id: ACCESS_TOKEN,
    status: RecipientStatus.PENDING,
    sent_at: new Date('2026-01-01T11:00:00.000Z'),
    first_accessed_at: null,
    last_accessed_at: null,
    signing_status: SigningStatus.PENDING,
    signed_at: null,
    created_at: new Date('2026-01-01T11:00:00.000Z'),
    updated_at: new Date('2026-01-01T11:00:00.000Z'),
    document: makeDocument(),
    user: null,
    signing_events: [],
    signed_artifact: null,
    ...overrides,
  };
}

describe('DocumentSigningService', () => {
  let service: DocumentSigningService;
  let entityManager: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let locksService: {
    hasUnresolvedLocks: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let emailService: {
    sendSignedNotification: jest.Mock;
    sendRejectedNotification: jest.Mock;
    sendRevokedNotification: jest.Mock;
    sendUnshared: jest.Mock;
  };
  let qb: Partial<SelectQueryBuilder<Document>>;

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    entityManager = {
      findOne: jest
        .fn()
        .mockImplementation(
          (entity: unknown, options: { where?: Record<string, unknown> }) => {
            // Auto-resolve owner (User) lookups by patient_id
            if (entity === User && options?.where?.patient_id) {
              return Promise.resolve({
                patient_id: OWNER_ID,
                name: 'John',
                last_name: 'Doe',
                email: 'owner@example.com',
                deleted_at: null,
              } as User);
            }
            return Promise.resolve(undefined);
          },
        ),
      save: jest.fn((entity: Record<string, unknown>) => {
        if (entity.signature_algorithm) {
          return { id: 'artifact-uuid', ...entity };
        }
        return entity;
      }),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
        ...data,
      })),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    locksService = {
      hasUnresolvedLocks: jest.fn().mockResolvedValue(false),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'signing') return mockSigningConfig;
        return undefined;
      }),
    };

    emailService = {
      sendSignedNotification: jest.fn().mockResolvedValue(undefined),
      sendRejectedNotification: jest.fn().mockResolvedValue(undefined),
      sendRevokedNotification: jest.fn().mockResolvedValue(undefined),
      sendUnshared: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSigningService,
        { provide: EntityManager, useValue: entityManager },
        { provide: ConfigService, useValue: configService },
        { provide: LocksService, useValue: locksService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(DocumentSigningService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('recordAccessByPublicLinkId', () => {
    it('stores first and last access timestamps and appends event', async () => {
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());

      await service.recordAccessByPublicLinkId(
        ACCESS_TOKEN,
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(entityManager.save).toHaveBeenCalledTimes(2);
      expect(entityManager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          first_accessed_at: expect.any(Date),
          last_accessed_at: expect.any(Date),
        }),
      );
    });

    it('throws NotFoundException for invalid public link id', async () => {
      entityManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.recordAccessByPublicLinkId(
          ACCESS_TOKEN,
          {
            ip: null,
            userAgent: null,
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('signByPublicLinkId', () => {
    it('signs recipient, stores artifact and returns summary with Ed25519', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeRecipient())
        .mockResolvedValueOnce(null); // no previous artifact
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      const result = await service.signByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          verification_reference: 'otp-session-1',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(result.status).toBe('SIGNED');
      expect(result.artifact_id).toBe('artifact-uuid');
      expect(result.signature_algorithm).toBe('Ed25519');
      expect(locksService.hasUnresolvedLocks).toHaveBeenCalledWith(
        DOC_ID,
        RECIPIENT_ID,
        entityManager,
      );
    });

    it('chains to previous artifact when one exists', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeRecipient())
        .mockResolvedValueOnce({
          patient_id: OWNER_ID,
          deleted_at: null,
        })
        .mockResolvedValueOnce({ id: 'prev-artifact-id' });
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      const result = await service.signByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          verification_reference: 'otp-session-1',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(result.status).toBe('SIGNED');
      // Verify the artifact was created with previous_artifact_id
      expect(entityManager.create).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          previous_artifact_id: 'prev-artifact-id',
          signature_algorithm: 'Ed25519',
          key_fingerprint: testFingerprint,
          key_version: 1,
        }),
      );
    });

    it('rejects signing with unresolved locks', async () => {
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());
      locksService.hasUnresolvedLocks.mockResolvedValueOnce(true);

      await expect(
        service.signByPublicLinkId(
          ACCESS_TOKEN,
          {},
          {
            ip: '127.0.0.1',
            userAgent: 'jest',
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects signing an already signed recipient', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({ signing_status: SigningStatus.SIGNED }),
      );

      await expect(
        service.signByPublicLinkId(
          ACCESS_TOKEN,
          {},
          {
            ip: null,
            userAgent: null,
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws InternalServerErrorException when signing key is not configured', async () => {
      configService.get.mockReturnValue(undefined);
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      await expect(
        service.signByPublicLinkId(
          ACCESS_TOKEN,
          {},
          {
            ip: null,
            userAgent: null,
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('fires signed notification email to document owner after signing', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeRecipient())
        .mockResolvedValueOnce(null); // no previous artifact
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      await service.signByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          verification_reference: 'otp-session-1',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(emailService.sendSignedNotification).toHaveBeenCalledWith(
        'owner@example.com',
        'Employment Contract',
        'Alice',
        expect.any(String),
        'John Doe',
      );
    });
  });

  describe('deleted sender (T-2.3)', () => {
    it('rejects signing with 410 Gone when document sender is deleted', async () => {
      // Override the third findOne (owner check) to return deleted user
      entityManager.findOne
        .mockResolvedValueOnce(makeRecipient())
        .mockResolvedValueOnce({
          patient_id: OWNER_ID,
          deleted_at: new Date('2026-06-01'),
        });
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      await expect(
        service.signByPublicLinkId(
          ACCESS_TOKEN,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: 'otp-session-1',
          },
          {
            ip: '127.0.0.1',
            userAgent: 'jest',
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(GoneException);
    });

    it('includes correct Spanish error message for deleted sender', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeRecipient())
        .mockResolvedValueOnce({
          patient_id: OWNER_ID,
          deleted_at: new Date('2026-06-01'),
        });
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      await expect(
        service.signByPublicLinkId(
          ACCESS_TOKEN,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: 'otp-session-1',
          },
          {
            ip: '127.0.0.1',
            userAgent: 'jest',
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow('El remitente ha eliminado su cuenta');
    });

    it('allows signing when document sender is NOT deleted', async () => {
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      const result = await service.signByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          verification_reference: 'otp-session-1',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(result.status).toBe('SIGNED');
    });

    it('also blocks signByRecipientUserId when sender is deleted', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(
          makeRecipient({
            document: makeDocument({ status: DocumentStatus.SENT }),
          }),
        )
        .mockResolvedValueOnce({
          patient_id: OWNER_ID,
          deleted_at: new Date('2026-06-01'),
        });
      (qb.getOne as jest.Mock).mockResolvedValueOnce(makeDocument());

      await expect(
        service.signByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {
            verification_method: VerificationMethod.OTP,
            verification_reference: 'otp-session-1',
          },
          {
            ip: '127.0.0.1',
            userAgent: 'jest',
          },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(GoneException);
    });
  });

  describe('rejectByPublicLinkId', () => {
    it('marks recipient as rejected and appends event', async () => {
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());

      await service.rejectByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          reason: 'Needs legal review',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(entityManager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ signing_status: SigningStatus.REJECTED }),
      );
    });

    it('fires rejected notification email to document owner after rejecting', async () => {
      entityManager.findOne.mockResolvedValueOnce(makeRecipient());

      await service.rejectByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          reason: 'Needs legal review',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(emailService.sendRejectedNotification).toHaveBeenCalledWith(
        'owner@example.com',
        'Employment Contract',
        'Alice',
        expect.any(String),
        'John Doe',
      );
    });
  });

  describe('revokeByPublicLinkId', () => {
    it('marks recipient as revoked and appends event', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({ signing_status: SigningStatus.SIGNED }),
      );

      await service.revokeByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          reason: 'I revoke my consent',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(entityManager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ signing_status: SigningStatus.REVOKED }),
      );
    });

    it('fires revoked notification email to document owner after revoking', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({ signing_status: SigningStatus.SIGNED }),
      );

      await service.revokeByPublicLinkId(
        ACCESS_TOKEN,
        {
          verification_method: VerificationMethod.OTP,
          reason: 'I revoke my consent',
        },
        {
          ip: '127.0.0.1',
          userAgent: 'jest',
        },
        entityManager as unknown as EntityManager,
      );

      expect(emailService.sendRevokedNotification).toHaveBeenCalledWith(
        'owner@example.com',
        'Employment Contract',
        'Alice',
        expect.any(String),
        'John Doe',
      );
    });
  });

  describe('revokeRecipient', () => {
    it('revokes recipient for document owner', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeDocument())
        .mockResolvedValueOnce(makeRecipient());

      await service.revokeRecipientByOwner(
        DOC_ID,
        RECIPIENT_ID,
        OWNER_ID,
        { reason: 'Owner replaced recipient' },
        entityManager as unknown as EntityManager,
      );

      expect(entityManager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ signing_status: SigningStatus.REVOKED }),
      );
    });

    it('rejects revocation when recipient already signed', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeDocument())
        .mockResolvedValueOnce(
          makeRecipient({ signing_status: SigningStatus.SIGNED }),
        );

      await expect(
        service.revokeRecipientByOwner(
          DOC_ID,
          RECIPIENT_ID,
          OWNER_ID,
          {},
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('returns email context when revocation succeeds', async () => {
      entityManager.findOne
        .mockResolvedValueOnce(makeDocument({ title: 'Employment Contract' }))
        .mockResolvedValueOnce(
          makeRecipient({ signing_status: SigningStatus.PENDING }),
        );

      const result = await service.revokeRecipientByOwner(
        DOC_ID,
        RECIPIENT_ID,
        OWNER_ID,
        { reason: 'Revoked by owner' },
        entityManager as unknown as EntityManager,
      );

      expect(result).toMatchObject({
        recipientEmail: 'recipient@example.com',
        recipientName: 'Alice',
        documentName: 'Employment Contract',
        senderName: 'John Doe',
      });
    });
  });

  describe('rejectByRecipientUserId', () => {
    it('marks recipient as rejected and returns response', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({
          document: makeDocument({ status: DocumentStatus.SENT }),
        }),
      );

      const result = await service.rejectByRecipientUserId(
        DOC_ID,
        OWNER_ID,
        { reason: 'Not agreed' },
        { ip: '127.0.0.1', userAgent: 'jest' },
        entityManager as unknown as EntityManager,
      );

      expect(entityManager.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ signing_status: SigningStatus.REJECTED }),
      );
      expect(result).toMatchObject({
        id: DOC_ID,
        status: 'REJECTED',
        rejected_at: expect.any(String),
      });
    });

    it('throws NotFoundException when recipient record not found', async () => {
      entityManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.rejectByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {},
          { ip: null, userAgent: null },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when document is not SENT', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({
          document: makeDocument({ status: DocumentStatus.VOIDED }),
        }),
      );

      await expect(
        service.rejectByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {},
          { ip: null, userAgent: null },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when already signed', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({
          signing_status: SigningStatus.SIGNED,
          document: makeDocument({ status: DocumentStatus.SENT }),
        }),
      );

      await expect(
        service.rejectByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {},
          { ip: null, userAgent: null },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when already rejected', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({
          signing_status: SigningStatus.REJECTED,
          document: makeDocument({ status: DocumentStatus.SENT }),
        }),
      );

      await expect(
        service.rejectByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {},
          { ip: null, userAgent: null },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when already revoked', async () => {
      entityManager.findOne.mockResolvedValueOnce(
        makeRecipient({
          signing_status: SigningStatus.REVOKED,
          document: makeDocument({ status: DocumentStatus.SENT }),
        }),
      );

      await expect(
        service.rejectByRecipientUserId(
          DOC_ID,
          OWNER_ID,
          {},
          { ip: null, userAgent: null },
          entityManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
