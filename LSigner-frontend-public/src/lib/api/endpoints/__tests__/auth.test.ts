import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { loginApi, getMeApi, logoutApi, refreshApi } from '../auth';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const MOCK_TOKENS = {
  access_token: 'jwt.mock.token',
  refresh_token: 'rt.mock.token',
  expires_in: 3600,
};

const MOCK_USER = {
  patient_id: 'usr-123',
  name: 'Test',
  last_name: 'User',
  country: 'Spain',
  national_id: '12345678A',
  passport: null,
  email: 'test@example.com',
  phone_number: '+34600000000',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loginApi', () => {
  it('POST /auth/login with email, password and skipAuth', async () => {
    vi.mocked(api.post).mockResolvedValue(MOCK_TOKENS);

    const result = await loginApi('a@b.com', 'secret');

    expect(api.post).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'a@b.com', password: 'secret' },
      { skipAuth: true },
    );
    expect(result).toEqual(MOCK_TOKENS);
  });
});

describe('getMeApi', () => {
  it('GET /users/me with explicit token', async () => {
    vi.mocked(api.get).mockResolvedValue(MOCK_USER);

    const result = await getMeApi('jwt.mock.token');

    expect(api.get).toHaveBeenCalledWith('/users/me', {
      token: 'jwt.mock.token',
    });
    expect(result).toEqual(MOCK_USER);
  });
});

describe('logoutApi', () => {
  it('POST /auth/logout with refresh_token in body', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    await logoutApi('rt.mock.token');

    expect(api.post).toHaveBeenCalledWith('/auth/logout', {
      refresh_token: 'rt.mock.token',
    });
  });
});

describe('refreshApi', () => {
  it('POST /auth/refresh with refresh_token and skipAuth', async () => {
    vi.mocked(api.post).mockResolvedValue(MOCK_TOKENS);

    const result = await refreshApi('rt.mock.token');

    expect(api.post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refresh_token: 'rt.mock.token' },
      { skipAuth: true },
    );
    expect(result).toEqual(MOCK_TOKENS);
  });

  it('throws when the refresh call fails', async () => {
    const apiError = new Error('Refresh failed');
    vi.mocked(api.post).mockRejectedValue(apiError);

    await expect(refreshApi('bad.token')).rejects.toThrow('Refresh failed');
  });
});
