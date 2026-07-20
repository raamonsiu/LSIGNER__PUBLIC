import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, SESSION_KEY } from '@/lib/auth/AuthContext';
import type {
  AuthUser,
  LoginResponse,
  RegisterDto,
} from '@/lib/api/endpoints/types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

type LoginApiSig = (email: string, password: string) => Promise<LoginResponse>;
type RefreshApiSig = (refreshToken: string) => Promise<LoginResponse>;
type GetMeApiSig = (accessToken: string) => Promise<AuthUser>;
type LogoutApiSig = (refreshToken: string) => Promise<void>;
type RegisterApiSig = (dto: RegisterDto) => Promise<void>;

const mockLoginApi = vi.fn<LoginApiSig>();
const mockGetMeApi = vi.fn<GetMeApiSig>();
const mockLogoutApi = vi.fn<LogoutApiSig>();
const mockRefreshApi = vi.fn<RefreshApiSig>();
const mockRegisterApi = vi.fn<RegisterApiSig>();
const mockSetTokenProvider = vi.fn<(token: string | null) => void>();
const mockSetOnUnauthorized = vi.fn<(cb: (() => void) | null) => void>();
const mockSetRefreshSession =
  vi.fn<(cb: (() => Promise<boolean>) | null) => void>();

vi.mock('@/lib/api/endpoints/auth', () => ({
  loginApi: ((email: string, password: string) =>
    mockLoginApi(email, password)) as LoginApiSig,
  getMeApi: ((accessToken: string) => mockGetMeApi(accessToken)) as GetMeApiSig,
  logoutApi: ((refreshToken: string) =>
    mockLogoutApi(refreshToken)) as LogoutApiSig,
  refreshApi: ((refreshToken: string) =>
    mockRefreshApi(refreshToken)) as RefreshApiSig,
}));

vi.mock('@/lib/api/endpoints/users', () => ({
  registerApi: ((dto: RegisterDto) => mockRegisterApi(dto)) as RegisterApiSig,
}));

vi.mock('@/lib/api', () => ({
  setTokenProvider: ((token: string | null) => mockSetTokenProvider(token)) as (
    token: string | null,
  ) => void,
  setOnUnauthorized: ((cb: (() => void) | null) =>
    mockSetOnUnauthorized(cb)) as (cb: (() => void) | null) => void,
  setRefreshSession: ((cb: (() => Promise<boolean>) | null) =>
    mockSetRefreshSession(cb)) as (cb: (() => Promise<boolean>) | null) => void,
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_USER: AuthUser = {
  patient_id: 'usr-1',
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

const VALID_SESSION = {
  accessToken: 'valid.jwt',
  refreshToken: 'valid.rt',
  expiresAt: Date.now() + 3600_000,
  user: MOCK_USER,
};

const EXPIRED_SESSION = {
  ...VALID_SESSION,
  expiresAt: Date.now() - 1000,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user?.email ?? 'null'}</span>
      <span data-testid="isAuth">{String(auth.isAuthenticated)}</span>
      <button
        data-testid="login"
        onClick={() => {
          auth.login('a@b.com', 'secret').catch(() => undefined);
        }}
      >
        login
      </button>
      <button
        data-testid="register"
        onClick={() => {
          auth
            .register({
              name: 'New',
              last_name: 'User',
              country: 'Spain',
              email: 'new@test.com',
              phone_number: '+34600000000',
              password: 'secret123',
            })
            .catch(() => undefined);
        }}
      >
        register
      </button>
      <button data-testid="logout" onClick={() => auth.logout()}>
        logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

function setSession(session: object) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearSession();
});

afterEach(() => {
  clearSession();
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    function Naked() {
      useAuth();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(
      'useAuth must be used within an AuthProvider',
    );
  });
});

describe('AuthProvider — session restoration', () => {
  it('restores user from a valid stored session on mount', () => {
    setSession(VALID_SESSION);
    renderProvider();
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('isAuth')).toHaveTextContent('true');
  });

  it('registers the token provider when a valid session exists', () => {
    setSession(VALID_SESSION);
    renderProvider();
    expect(mockSetTokenProvider).toHaveBeenCalledWith(expect.any(Function));
  });

  it('clears expired sessions on mount and redirects to /login?reason=expired', () => {
    setSession(EXPIRED_SESSION);
    renderProvider();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(mockSetTokenProvider).toHaveBeenCalledWith(null);
    expect(mockReplace).toHaveBeenCalledWith('/login?reason=expired');
  });

  it('shows null user when no session exists', () => {
    renderProvider();
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('isAuth')).toHaveTextContent('false');
  });
});

describe('AuthProvider — login', () => {
  const TOKENS: LoginResponse = {
    access_token: 'jwt.from.login',
    refresh_token: 'rt.from.login',
    expires_in: 3600,
  };

  it('calls loginApi and getMeApi, writes session, registers token, sets user', async () => {
    mockLoginApi.mockResolvedValue(TOKENS);
    mockGetMeApi.mockResolvedValue(MOCK_USER);

    renderProvider();

    screen.getByTestId('login').click();

    await waitFor(() => {
      expect(mockLoginApi).toHaveBeenCalledWith('a@b.com', 'secret');
    });
    expect(mockGetMeApi).toHaveBeenCalledWith('jwt.from.login');

    const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!);
    expect(stored.accessToken).toBe('jwt.from.login');
    expect(stored.refreshToken).toBe('rt.from.login');
    expect(stored.user).toEqual(MOCK_USER);

    expect(mockSetTokenProvider).toHaveBeenCalledWith(expect.any(Function));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
    expect(screen.getByTestId('isAuth')).toHaveTextContent('true');
  });

  it('does not update UI or persist session when getMeApi fails', async () => {
    mockLoginApi.mockResolvedValue(TOKENS);
    mockGetMeApi.mockRejectedValue(new Error('profile fetch failed'));

    renderProvider();

    screen.getByTestId('login').click();

    await waitFor(() => {
      expect(mockGetMeApi).toHaveBeenCalled();
    });

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId('isAuth')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });
});

describe('AuthProvider — register', () => {
  it('calls registerApi and does not log in or persist session', async () => {
    mockRegisterApi.mockResolvedValue(undefined);

    renderProvider();
    screen.getByTestId('register').click();

    await waitFor(() => {
      expect(mockRegisterApi).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com' }),
      );
    });

    expect(mockLoginApi).not.toHaveBeenCalled();
    expect(mockGetMeApi).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(screen.getByTestId('isAuth')).toHaveTextContent('false');
  });
});

describe('AuthProvider — logout', () => {
  it('calls logoutApi with refresh token, clears session, redirects to /login', async () => {
    setSession(VALID_SESSION);
    mockLogoutApi.mockResolvedValue(undefined);

    renderProvider();

    expect(screen.getByTestId('isAuth')).toHaveTextContent('true');

    screen.getByTestId('logout').click();

    await waitFor(() => {
      expect(mockLogoutApi).toHaveBeenCalledWith('valid.rt');
    });

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(mockSetTokenProvider).toHaveBeenCalledWith(null);
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.getByTestId('isAuth')).toHaveTextContent('false');
  });

  it('clears session even when logoutApi fails', async () => {
    setSession(VALID_SESSION);
    mockLogoutApi.mockRejectedValue(new Error('network error'));

    renderProvider();
    screen.getByTestId('logout').click();

    await waitFor(() => {
      expect(mockLogoutApi).toHaveBeenCalled();
    });

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(mockSetTokenProvider).toHaveBeenCalledWith(null);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('does not call logoutApi when no refresh token exists', async () => {
    const sessionWithoutRt = { ...VALID_SESSION, refreshToken: '' };
    setSession(sessionWithoutRt);

    renderProvider();
    screen.getByTestId('logout').click();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    expect(mockLogoutApi).not.toHaveBeenCalled();
  });
});
