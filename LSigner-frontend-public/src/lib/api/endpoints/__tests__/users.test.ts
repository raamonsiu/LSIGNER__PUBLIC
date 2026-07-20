import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { registerApi, searchUsersApi, deleteMyAccountApi } from '../users';
import type { UserSearchResult } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const REGISTER_DTO = {
  name: 'New',
  last_name: 'User',
  country: 'Spain',
  email: 'new@example.com',
  phone_number: '+34600000000',
  password: 'securePass1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerApi', () => {
  it('POST /users with dto and skipAuth', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await registerApi(REGISTER_DTO);

    expect(api.post).toHaveBeenCalledWith('/users', REGISTER_DTO, {
      skipAuth: true,
    });
  });

  it('includes optional fields when provided', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);
    const withOptional = { ...REGISTER_DTO, national_id: '87654321B' };

    await registerApi(withOptional);

    expect(api.post).toHaveBeenCalledWith('/users', withOptional, {
      skipAuth: true,
    });
  });
});

it('resolves to void on success', async () => {
  vi.mocked(api.post).mockResolvedValue(undefined);

  await expect(registerApi(REGISTER_DTO)).resolves.toBeUndefined();
});

describe('searchUsersApi', () => {
  const MOCK_SEARCH_RESULTS: UserSearchResult[] = [
    {
      id: 'user-001',
      name: 'Alice',
      last_name: 'Example',
      email: 'alice@example.com',
    },
  ];

  it('GET /users/search?q= with query', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_SEARCH_RESULTS);

    const result = await searchUsersApi('alice');

    expect(api.get).toHaveBeenCalledWith('/users/search', {
      params: { q: 'alice' },
    });
    expect(result).toEqual(MOCK_SEARCH_RESULTS);
  });

  it('returns empty array when no matches', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const result = await searchUsersApi('nonexistent');

    expect(result).toEqual([]);
  });
});

describe('deleteMyAccountApi', () => {
  it('DELETE /users/me/delete and returns success message', async () => {
    const response = { message: 'Account deleted successfully' };
    vi.mocked(api.delete).mockResolvedValue(response);

    const result = await deleteMyAccountApi();

    expect(api.delete).toHaveBeenCalledWith('/users/me/delete');
    expect(result).toEqual(response);
  });

  it('throws when API call fails', async () => {
    const apiError = new Error('Server error');
    vi.mocked(api.delete).mockRejectedValue(apiError);

    await expect(deleteMyAccountApi()).rejects.toThrow('Server error');
  });
});
