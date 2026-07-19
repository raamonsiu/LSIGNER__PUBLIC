import { Document, DocumentStatus } from '../entities/document.entity';
import {
  DocumentRecipient,
  RecipientStatus,
} from '../entities/document-recipient.entity';
import { User } from '../entities/user.entity';
import {
  toSentListItem,
  toReceivedListItem,
  toSentDetail,
  toReceivedDetail,
  mapSentStatus,
} from './documents.mapper';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

function makeOwner(overrides: Partial<User> = {}): User {
  return {
    patient_id: OWNER_ID,
    name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    ...overrides,
  } as User;
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
    owner_id: OWNER_ID,
    title: 'Test Contract',
    description: 'A test document',
    file_hash: 'abc123',
    original_filename: 'contract.pdf',
    mime_type: 'application/pdf',
    file_size: '102400',
    status: DocumentStatus.SENT,
    version: 1,
    parent_document_id: null,
    parent_document: null,
    recipients: [],
    owner: makeOwner(),
    created_at: new Date('2026-06-01T10:00:00.000Z'),
    updated_at: new Date('2026-06-05T12:00:00.000Z'),
    ...overrides,
  } as Document;
}

function makeRecipient(
  overrides: Partial<DocumentRecipient> = {},
): DocumentRecipient {
  return {
    id: 'rec-001',
    document_id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
    user_id: 'rec-user-id',
    recipient_email: 'alice@example.com',
    recipient_name: 'Alice',
    status: RecipientStatus.PENDING,
    signing_status: 'PENDING',
    sent_at: new Date('2026-06-01T10:30:00.000Z'),
    created_at: new Date('2026-06-01T10:30:00.000Z'),
    updated_at: new Date('2026-06-01T10:30:00.000Z'),
    document: {} as Document,
    user: null,
    ...overrides,
  } as DocumentRecipient;
}

// ── mapSentStatus ─────────────────────────────────────────────────────────────

describe('mapSentStatus', () => {
  it('maps DRAFT -> "DRAFT"', () => {
    expect(mapSentStatus(DocumentStatus.DRAFT)).toBe('DRAFT');
  });

  it('maps SENT -> "WAITING"', () => {
    expect(mapSentStatus(DocumentStatus.SENT)).toBe('WAITING');
  });

  it('maps SUPERSEDED -> "SUPERSEDED"', () => {
    expect(mapSentStatus(DocumentStatus.SUPERSEDED)).toBe('SUPERSEDED');
  });

  it('maps VOIDED -> "VOIDED"', () => {
    expect(mapSentStatus(DocumentStatus.VOIDED)).toBe('VOIDED');
  });
});

// ── toSentListItem ────────────────────────────────────────────────────────────

describe('toSentListItem', () => {
  it('maps a Document with recipients to a SentDocumentsListItem', () => {
    const doc = makeDocument({
      recipients: [makeRecipient({ recipient_email: 'alice@example.com' })],
    });

    const result = toSentListItem(doc);

    expect(result).toEqual({
      id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
      document_name: 'Test Contract',
      file_size_bytes: 102400,
      sent_at: '2026-06-01T10:00:00.000Z',
      signed_at: null,
      final_recipient_name: 'alice@example.com',
      status: 'WAITING',
    });
  });

  it('maps DRAFT status as DRAFT', () => {
    const doc = makeDocument({ status: DocumentStatus.DRAFT });
    const result = toSentListItem(doc);
    expect(result.status).toBe('DRAFT');
  });

  it('uses null for final_recipient_name when no recipients', () => {
    const doc = makeDocument({ recipients: [] });
    const result = toSentListItem(doc);
    expect(result.final_recipient_name).toBeNull();
  });

  it('maps file_size from string to number', () => {
    const doc = makeDocument({ file_size: '0' });
    const result = toSentListItem(doc);
    expect(result.file_size_bytes).toBe(0);
  });
});

// ── toReceivedListItem ────────────────────────────────────────────────────────

describe('toReceivedListItem', () => {
  it('maps a Document + DocumentRecipient to a ReceivedDocumentsListItem', () => {
    const doc = makeDocument({
      owner: makeOwner({
        name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }),
    });
    const recipient = makeRecipient({
      sent_at: new Date('2026-06-01T10:30:00.000Z'),
    });

    const result = toReceivedListItem(doc, recipient);

    expect(result).toEqual({
      id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
      document_name: 'Test Contract',
      file_size_bytes: 102400,
      received_at: '2026-06-01T10:30:00.000Z',
      signed_at: null,
      expires_at: null,
      sender_name: 'John Doe',
      sender_email: 'john@example.com',
      status: 'PENDING',
    });
  });

  it('handles missing owner gracefully', () => {
    const doc = makeDocument({ owner: undefined as unknown as User });
    const recipient = makeRecipient();

    const result = toReceivedListItem(doc, recipient);

    expect(result.sender_name).toBeNull();
    expect(result.sender_email).toBe('');
  });
});

// ── toSentDetail ──────────────────────────────────────────────────────────────

describe('toSentDetail', () => {
  it('maps a Document with recipients to a SentDocumentDetailResponse', () => {
    const doc = makeDocument({
      recipients: [
        makeRecipient({
          id: 'rec-001',
          recipient_email: 'alice@example.com',
          recipient_name: 'Alice',
          sent_at: new Date('2026-06-01T10:30:00.000Z'),
        }),
      ],
    });

    const result = toSentDetail(doc);

    expect(result).toEqual({
      id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
      document_name: 'Test Contract',
      description: 'A test document',
      file_size_bytes: 102400,
      original_filename: 'contract.pdf',
      mime_type: 'application/pdf',
      version: 1,
      status: 'WAITING',
      sent_at: '2026-06-01T10:00:00.000Z',
      signed_at: null,
      final_recipient_name: 'alice@example.com',
      created_at: '2026-06-01T10:00:00.000Z',
      updated_at: '2026-06-05T12:00:00.000Z',
      recipients: [
        {
          id: 'rec-001',
          recipient_email: 'alice@example.com',
          recipient_name: 'Alice',
          sent_at: '2026-06-01T10:30:00.000Z',
          signing_status: 'PENDING',
          first_accessed_at: null,
          last_accessed_at: null,
          signed_at: null,
        },
      ],
    });
  });
});

// ── toReceivedDetail ──────────────────────────────────────────────────────────

describe('toReceivedDetail', () => {
  it('maps a Document + userId to a ReceivedDocumentDetailResponse', () => {
    const doc = makeDocument({
      owner: makeOwner({
        name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }),
      recipients: [
        makeRecipient({
          id: 'rec-001',
          user_id: 'rec-user-id',
          recipient_email: 'alice@example.com',
          recipient_name: 'Alice',
          sent_at: new Date('2026-06-01T10:30:00.000Z'),
        }),
      ],
    });

    const result = toReceivedDetail(doc, 'rec-user-id');

    expect(result).toEqual({
      id: 'c5dd301a-0ab1-5000-1134-ceg6g8765224',
      document_name: 'Test Contract',
      description: 'A test document',
      file_size_bytes: 102400,
      original_filename: 'contract.pdf',
      mime_type: 'application/pdf',
      version: 1,
      status: 'PENDING',
      received_at: '2026-06-01T10:30:00.000Z',
      signed_at: null,
      expires_at: null,
      created_at: '2026-06-01T10:00:00.000Z',
      updated_at: '2026-06-05T12:00:00.000Z',
      sender: {
        id: OWNER_ID,
        name: 'John Doe',
        email: 'john@example.com',
      },
      my_recipient: {
        id: 'rec-001',
        recipient_email: 'alice@example.com',
        recipient_name: 'Alice',
        signing_status: 'PENDING',
        first_accessed_at: null,
        last_accessed_at: null,
        signed_at: null,
        rejected_at: null,
        revoked_at: null,
      },
    });
  });
});
