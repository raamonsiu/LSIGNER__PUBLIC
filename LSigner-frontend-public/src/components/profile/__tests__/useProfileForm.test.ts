import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfileForm } from '../useProfileForm';
import type { AuthUser, UpdateUserDto } from '@/lib/api/endpoints/types';

const mockUpdateUserApi = vi.fn();
const mockUpdateUser = vi.fn();
const mockShowSnackbar = vi.fn();
const mockOnDone = vi.fn();

vi.mock('@/lib/api/endpoints/users', () => ({
  updateUserApi: (dto: UpdateUserDto) => mockUpdateUserApi(dto),
}));

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    updateUser: mockUpdateUser,
    user: null,
    isAuthenticated: true,
    isSessionRestored: true,
  }),
  SESSION_KEY: 'lsigner_session',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/providers/SnackbarProvider', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

vi.mock('@/app/locale/LocaleContext', () => ({
  useLocaleContext: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

const BASE_USER: AuthUser = {
  patient_id: 'uuid-123',
  name: 'John',
  last_name: 'Doe',
  country: 'ES',
  national_id: null,
  passport: null,
  email: 'john@example.com',
  phone_number: '+34600000000',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function buildHook(userOverrides?: Partial<AuthUser>) {
  return renderHook(
    ({ user }: { user: AuthUser }) => useProfileForm(user, mockOnDone),
    {
      initialProps: { user: { ...BASE_USER, ...userOverrides } },
    },
  );
}

describe('useProfileForm — handleSave patient_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUserApi.mockResolvedValue({
      name: 'John',
      last_name: 'Doe',
      country: 'ES',
      national_id: null,
      passport: null,
      email: 'john@example.com',
      phone_number: '+34600000000',
    });
  });

  it('2.1 sends patient_id in DTO when AuthUser.patient_id is set', async () => {
    const { result } = buildHook();

    // Simulate a dirty field so handleSave actually runs
    act(() => {
      result.current.handleFieldChange('name', 'John Updated');
    });

    // The save must include patient_id from the user
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockUpdateUserApi).toHaveBeenCalledTimes(1);
    const dtoArg = mockUpdateUserApi.mock.calls[0][0] as UpdateUserDto;
    expect(dtoArg.patient_id).toBe('uuid-123');
    expect(dtoArg.name).toBe('John Updated');
  });

  it('2.2 omits patient_id from DTO when AuthUser.patient_id is falsy', async () => {
    const { result } = buildHook({ patient_id: '' });

    act(() => {
      result.current.handleFieldChange('name', 'John Updated');
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockUpdateUserApi).toHaveBeenCalledTimes(1);
    const dtoArg = mockUpdateUserApi.mock.calls[0][0] as UpdateUserDto;
    expect(dtoArg.patient_id).toBeUndefined();
    expect(dtoArg.name).toBe('John Updated');
  });
});
