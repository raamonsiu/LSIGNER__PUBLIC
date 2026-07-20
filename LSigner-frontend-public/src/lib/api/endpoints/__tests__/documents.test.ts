import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  deleteSentDocumentSharedAccessApi,
  fetchDocumentDownloadBlobUrl,
  getReceivedDocumentByIdApi,
  getReceivedDocumentsApi,
  getReceivedDocumentViewUrlApi,
  getSentDocumentByIdApi,
  getSentDocumentsApi,
  sendDocumentApi,
  sendSentDocumentReminderApi,
  uploadDocumentApi,
} from '../documents';

// ─── Hoisted mock functions ───────────────────────────────────────────────

const { mockGetToken, mockTriggerRefresh } = vi.hoisted(() => ({
  mockGetToken: vi.fn<() => Promise<string | null>>(),
  mockTriggerRefresh: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  API_BASE_URL: 'http://localhost:3000',
  getToken: mockGetToken,
  triggerRefresh: mockTriggerRefresh,
}));

const MOCK_SENT_DOCUMENTS_LIST = {
  stats: {
    total_sent: 10,
    pending_final_signature: 3,
    unique_recipients: 6,
    completed: 7,
  },
  items: [
    {
      id: 'doc-001',
      document_name: 'NDA ABC Solutions',
      file_size_bytes: 204800,
      sent_at: '2026-06-20T09:00:00.000Z',
      signed_at: null,
      final_recipient_name: 'Alice Example',
      status: 'WAITING' as const,
    },
  ],
};

const MOCK_SENT_DOCUMENT_DETAIL = {
  id: 'doc-001',
  document_name: 'NDA ABC Solutions',
  description: null,
  file_size_bytes: 204800,
  original_filename: 'nda_abc_solutions.pdf',
  mime_type: 'application/pdf',
  version: 1,
  status: 'WAITING' as const,
  sent_at: '2026-06-20T09:00:00.000Z',
  signed_at: null,
  final_recipient_name: 'Alice Example',
  created_at: '2026-06-20T08:50:00.000Z',
  updated_at: '2026-06-20T09:00:00.000Z',
  recipients: [
    {
      id: 'rec-001',
      recipient_email: 'alice@example.com',
      recipient_name: 'Alice Example',
      sent_at: '2026-06-20T09:00:00.000Z',
      signing_status: 'PENDING' as const,
      first_accessed_at: null,
      last_accessed_at: null,
      signed_at: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSentDocumentsApi', () => {
  it('GET /documents/sent', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_SENT_DOCUMENTS_LIST);

    const result = await getSentDocumentsApi();

    expect(api.get).toHaveBeenCalledWith('/documents/sent');
    expect(result).toEqual(MOCK_SENT_DOCUMENTS_LIST);
  });
});

describe('getSentDocumentByIdApi', () => {
  it('GET /documents/sent/:id', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_SENT_DOCUMENT_DETAIL);

    const result = await getSentDocumentByIdApi('doc-001');

    expect(api.get).toHaveBeenCalledWith('/documents/sent/doc-001');
    expect(result).toEqual(MOCK_SENT_DOCUMENT_DETAIL);
  });

  it('encodes document id', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_SENT_DOCUMENT_DETAIL);

    await getSentDocumentByIdApi('doc/with spaces');

    expect(api.get).toHaveBeenCalledWith('/documents/sent/doc%2Fwith%20spaces');
  });
});

describe('sendSentDocumentReminderApi', () => {
  it('POST /documents/:id/recipients/:recipientId/reminder', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await sendSentDocumentReminderApi('doc-001', 'rec-001');

    expect(api.post).toHaveBeenCalledWith(
      '/documents/doc-001/recipients/rec-001/reminder',
    );
  });
});

describe('deleteSentDocumentSharedAccessApi', () => {
  it('DELETE /documents/:id/recipients/:recipientId/shared-access', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteSentDocumentSharedAccessApi('doc-001', 'rec-001');

    expect(api.delete).toHaveBeenCalledWith(
      '/documents/doc-001/recipients/rec-001/shared-access',
    );
  });

  it('encodes ids before deleting', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteSentDocumentSharedAccessApi('doc/001', 'rec/001 user');

    expect(api.delete).toHaveBeenCalledWith(
      '/documents/doc%2F001/recipients/rec%2F001%20user/shared-access',
    );
  });
});

describe('fetchDocumentDownloadBlobUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('test-jwt-token');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.mocked(global.fetch).mockRestore();
  });

  it('fetches blob on success', async () => {
    const blob = await fetchDocumentDownloadBlobUrl('doc-001');

    expect(blob.size).toBe(3);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/documents/doc-001/download',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
        credentials: 'include',
      }),
    );
  });

  it('throws DOWNLOAD_FAILED_401 on 401', async () => {
    mockTriggerRefresh.mockResolvedValue(false);
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(fetchDocumentDownloadBlobUrl('doc-001')).rejects.toThrow(
      'DOWNLOAD_FAILED_401',
    );
  });

  it('throws DOWNLOAD_FAILED_401 when no session exists', async () => {
    mockGetToken.mockResolvedValue(null);

    await expect(fetchDocumentDownloadBlobUrl('doc-001')).rejects.toThrow(
      'DOWNLOAD_FAILED_401',
    );
  });

  it('throws DOWNLOAD_FAILED on network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    await expect(fetchDocumentDownloadBlobUrl('doc-001')).rejects.toThrow(
      'DOWNLOAD_FAILED',
    );
  });

  it('throws DOWNLOAD_FAILED on non-2xx', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await expect(fetchDocumentDownloadBlobUrl('doc-001')).rejects.toThrow(
      'DOWNLOAD_FAILED',
    );
  });

  it('encodes document id in URL', async () => {
    await fetchDocumentDownloadBlobUrl('doc/with spaces');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/documents/doc%2Fwith%20spaces/download',
      expect.anything(),
    );
  });
});

const MOCK_RECEIVED_DOCUMENTS_LIST = {
  stats: {
    total_received: 5,
    pending_my_signature: 2,
    signed_by_me: 2,
    rejected_or_revoked: 1,
  },
  items: [
    {
      id: 'recv-001',
      document_name: 'Contract ACME',
      file_size_bytes: 102400,
      received_at: '2026-06-21T08:00:00.000Z',
      signed_at: null,
      expires_at: '2026-07-01T23:59:59.000Z',
      sender_name: 'Alice Example',
      sender_email: 'alice@example.com',
      status: 'PENDING' as const,
    },
  ],
};

const MOCK_RECEIVED_DOCUMENT_DETAIL = {
  id: 'recv-001',
  document_name: 'Contract ACME',
  description: 'Please review and sign',
  file_size_bytes: 102400,
  original_filename: 'contract_acme.pdf',
  mime_type: 'application/pdf',
  version: 1,
  status: 'PENDING' as const,
  received_at: '2026-06-21T08:00:00.000Z',
  signed_at: null,
  expires_at: '2026-07-01T23:59:59.000Z',
  created_at: '2026-06-21T07:50:00.000Z',
  updated_at: '2026-06-21T08:00:00.000Z',
  sender: {
    id: 'user-001',
    name: 'Alice Example',
    email: 'alice@example.com',
  },
  my_recipient: {
    id: 'rec-001',
    recipient_email: 'me@example.com',
    recipient_name: 'Bob Example',
    signing_status: 'PENDING' as const,
    first_accessed_at: null,
    last_accessed_at: null,
    signed_at: null,
    rejected_at: null,
    revoked_at: null,
  },
};

describe('getReceivedDocumentsApi', () => {
  it('GET /documents/received', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_RECEIVED_DOCUMENTS_LIST);

    const result = await getReceivedDocumentsApi();

    expect(api.get).toHaveBeenCalledWith('/documents/received');
    expect(result).toEqual(MOCK_RECEIVED_DOCUMENTS_LIST);
  });
});

describe('getReceivedDocumentByIdApi', () => {
  it('GET /documents/received/:id', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_RECEIVED_DOCUMENT_DETAIL);

    const result = await getReceivedDocumentByIdApi('recv-001');

    expect(api.get).toHaveBeenCalledWith('/documents/received/recv-001');
    expect(result).toEqual(MOCK_RECEIVED_DOCUMENT_DETAIL);
  });

  it('encodes document id', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_RECEIVED_DOCUMENT_DETAIL);

    await getReceivedDocumentByIdApi('doc/with spaces');

    expect(api.get).toHaveBeenCalledWith(
      '/documents/received/doc%2Fwith%20spaces',
    );
  });
});

describe('getReceivedDocumentViewUrlApi', () => {
  it('GET /documents/received/:id/view-url', async () => {
    vi.mocked(api.get).mockResolvedValue({
      url: 'https://cdn.example.com/documents/recv-001.pdf',
    });

    const result = await getReceivedDocumentViewUrlApi('recv-001');

    expect(api.get).toHaveBeenCalledWith(
      '/documents/received/recv-001/view-url',
    );
    expect(result).toEqual({
      url: 'https://cdn.example.com/documents/recv-001.pdf',
    });
  });
});

describe('uploadDocumentApi', () => {
  it('POST /documents with FormData and raw flag', async () => {
    const mockResponse = { id: 'doc-upload-001', title: 'test-doc' };
    vi.mocked(api.post).mockResolvedValue(mockResponse);

    const file = new File(['test content'], 'test-file.pdf', {
      type: 'application/pdf',
    });
    const result = await uploadDocumentApi(file, 'test-file', 'my description');

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body, config] = vi.mocked(api.post).mock.calls[0];
    expect(path).toBe('/documents');
    expect(body).toBeInstanceOf(FormData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = body as any;
    expect(fd.get('file')).toEqual(file);
    expect(fd.get('title')).toBe('test-file');
    expect(fd.get('description')).toBe('my description');
    expect(config).toEqual({ raw: true });
    expect(result).toEqual(mockResponse);
  });

  it('omits description from FormData when not provided', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'doc-002', title: 'test' });

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    await uploadDocumentApi(file, 'test');

    const [, body] = vi.mocked(api.post).mock.calls[0];
    expect(body).toBeInstanceOf(FormData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((body as any).get('description')).toBeNull();
  });
});

describe('sendDocumentApi', () => {
  it('POST /documents/:id/send with recipients dto', async () => {
    const mockResponse = {
      document_id: 'doc-001',
      status: 'WAITING',
      recipients: [
        {
          id: 'rec-001',
          recipient_email: 'alice@example.com',
          signing_status: 'PENDING',
        },
      ],
    };
    vi.mocked(api.post).mockResolvedValue(mockResponse);

    const result = await sendDocumentApi('doc-001', {
      recipients: [
        {
          recipient_email: 'alice@example.com',
          recipient_name: 'Alice',
        },
      ],
    });

    expect(api.post).toHaveBeenCalledWith('/documents/doc-001/send', {
      recipients: [
        { recipient_email: 'alice@example.com', recipient_name: 'Alice' },
      ],
    });
    expect(result).toEqual(mockResponse);
  });
});
