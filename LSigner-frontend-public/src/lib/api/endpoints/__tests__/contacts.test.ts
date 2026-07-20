import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  createContactApi,
  deleteContactApi,
  getContactsApi,
} from '../contacts';
import type { ContactResponse, CreateContactDto } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const MOCK_CONTACT: ContactResponse = {
  id: 'contact-001',
  contact_email: 'alice@example.com',
  contact_name: 'Alice Example',
  contact_phone: '+34600000000',
  contact_user_id: null,
  created_at: '2026-06-28T10:00:00.000Z',
};

const MOCK_CONTACTS_LIST: ContactResponse[] = [MOCK_CONTACT];

const CREATE_DTO: CreateContactDto = {
  contact_email: 'alice@example.com',
  contact_name: 'Alice Example',
  contact_phone: '+34600000000',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getContactsApi', () => {
  it('GET /contacts without query', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_CONTACTS_LIST);

    const result = await getContactsApi();

    expect(api.get).toHaveBeenCalledWith('/contacts');
    expect(result).toEqual(MOCK_CONTACTS_LIST);
  });

  it('GET /contacts?q= with query param', async () => {
    vi.mocked(api.get).mockResolvedValue([MOCK_CONTACT]);

    const result = await getContactsApi('alice');

    expect(api.get).toHaveBeenCalledWith('/contacts', {
      params: { q: 'alice' },
    });
    expect(result).toEqual([MOCK_CONTACT]);
  });

  it('returns empty array when no contacts', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const result = await getContactsApi();

    expect(result).toEqual([]);
  });
});

describe('createContactApi', () => {
  it('POST /contacts with dto', async () => {
    vi.mocked(api.post).mockResolvedValue(MOCK_CONTACT);

    const result = await createContactApi(CREATE_DTO);

    expect(api.post).toHaveBeenCalledWith('/contacts', CREATE_DTO);
    expect(result).toEqual(MOCK_CONTACT);
  });

  it('POST /contacts with minimal dto (email only)', async () => {
    vi.mocked(api.post).mockResolvedValue({
      ...MOCK_CONTACT,
      contact_name: null,
      contact_phone: null,
    });
    const minimalDto: CreateContactDto = {
      contact_email: 'bob@example.com',
    };

    const result = await createContactApi(minimalDto);

    expect(api.post).toHaveBeenCalledWith('/contacts', minimalDto);
    expect(result.contact_name).toBeNull();
    expect(result.contact_phone).toBeNull();
  });
});

describe('deleteContactApi', () => {
  it('DELETE /contacts/:id', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteContactApi('contact-001');

    expect(api.delete).toHaveBeenCalledWith('/contacts/contact-001');
  });

  it('encodes contact id', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await deleteContactApi('contact/with spaces');

    expect(api.delete).toHaveBeenCalledWith(
      '/contacts/contact%2Fwith%20spaces',
    );
  });
});
