import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  SigningStatus,
} from '../entities/document-recipient.entity';
import { findRecipientById } from './recipient-helper';

describe('findRecipientById', () => {
  let entityManager: { findOne: jest.Mock };

  const RECIPIENT_ID = 'bb4ef8d8-1302-44bb-8f5d-d0822710c431';
  const DOC_ID = 'c5dd301a-0ab1-5000-1134-ceg6g8765224';

  function makeRecipient(
    overrides: Partial<DocumentRecipient> = {},
  ): DocumentRecipient {
    return {
      id: RECIPIENT_ID,
      document_id: DOC_ID,
      user_id: null,
      recipient_email: 'recipient@example.com',
      recipient_name: 'Alice',
      public_link_id: 'some-public-link-id',
      status: 'PENDING' as DocumentRecipient['status'],
      sent_at: new Date('2026-01-01T11:00:00.000Z'),
      first_accessed_at: null,
      last_accessed_at: null,
      signing_status: SigningStatus.PENDING,
      signed_at: null,
      created_at: new Date('2026-01-01T11:00:00.000Z'),
      updated_at: new Date('2026-01-01T11:00:00.000Z'),
      document: {
        id: DOC_ID,
        owner_id: 'owner-uuid',
        title: 'Test Document',
        description: null,
        file: Buffer.from('test'),
        file_hash: 'hash',
        original_filename: 'test.pdf',
        mime_type: 'application/pdf',
        file_size: '100',
        status: DocumentStatus.SENT,
        version: 1,
        parent_document_id: null,
        parent_document: null,
        recipients: [],
        locks: [],
        owner: null,
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        updated_at: new Date('2026-01-01T10:00:00.000Z'),
      } as Document,
      user: null,
      signing_events: [],
      signed_artifact: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    entityManager = {
      findOne: jest.fn(),
    };
  });

  it('finds a recipient by id with document relation', async () => {
    const recipient = makeRecipient();
    entityManager.findOne.mockResolvedValueOnce(recipient);

    const result = await findRecipientById(
      RECIPIENT_ID,
      entityManager as unknown as EntityManager,
    );

    expect(result).toBe(recipient);
    expect(entityManager.findOne).toHaveBeenCalledWith(DocumentRecipient, {
      where: { id: RECIPIENT_ID },
      relations: ['document'],
    });
  });

  it('throws NotFoundException when recipient does not exist', async () => {
    entityManager.findOne.mockResolvedValueOnce(null);

    await expect(
      findRecipientById(
        RECIPIENT_ID,
        entityManager as unknown as EntityManager,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when document is voided', async () => {
    entityManager.findOne.mockResolvedValueOnce(
      makeRecipient({
        document: {
          id: DOC_ID,
          status: DocumentStatus.VOIDED,
        } as Document,
      }),
    );

    await expect(
      findRecipientById(
        RECIPIENT_ID,
        entityManager as unknown as EntityManager,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns recipient with PENDING signing status', async () => {
    const recipient = makeRecipient({ signing_status: SigningStatus.PENDING });
    entityManager.findOne.mockResolvedValueOnce(recipient);

    const result = await findRecipientById(
      RECIPIENT_ID,
      entityManager as unknown as EntityManager,
    );

    expect(result.signing_status).toBe(SigningStatus.PENDING);
  });

  it('returns recipient with SIGNED signing status', async () => {
    const recipient = makeRecipient({ signing_status: SigningStatus.SIGNED });
    entityManager.findOne.mockResolvedValueOnce(recipient);

    const result = await findRecipientById(
      RECIPIENT_ID,
      entityManager as unknown as EntityManager,
    );

    expect(result.signing_status).toBe(SigningStatus.SIGNED);
  });
});
