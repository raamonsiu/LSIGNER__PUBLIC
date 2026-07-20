import { describe, it, expect, vi } from 'vitest';
import { handleFormError } from '@/lib/api/error-handler';
import { ApiError } from '@/lib/api';

interface ApiErrorInit {
  statusCode: number;
  error: string;
  message: string;
  path?: string;
  timestamp?: string;
  requestId?: string;
  body?: unknown;
  isAbort?: boolean;
}

function createError(overrides: Partial<ApiErrorInit> = {}): ApiError {
  return new ApiError({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Something went wrong',
    ...overrides,
  });
}

function makeSnackbarSpy() {
  return vi.fn();
}

describe('handleFormError', () => {
  it('shows generic error for non-ApiError exceptions', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(new Error('boom'), 'login', showSnackbar);
    expect(showSnackbar).toHaveBeenCalledWith(
      'Unexpected error. Try again.',
      'error',
    );
  });

  it('shows "incorrect credentials" for 401 on login', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(createError({ statusCode: 401 }), 'login', showSnackbar);
    expect(showSnackbar).toHaveBeenCalledWith(
      'Incorrect credentials. Check your email and password.',
      'error',
    );
  });

  it('does not show login-specific message for 401 on register', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(createError({ statusCode: 401 }), 'register', showSnackbar);
    // Falls through to the generic server error
    expect(showSnackbar).toHaveBeenCalledWith(
      'Server error. Try again later.',
      'error',
    );
  });

  it('uses ApiError.message for 400 when no validation messages', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(
      createError({ statusCode: 400, message: 'Email already taken' }),
      'register',
      showSnackbar,
    );
    expect(showSnackbar).toHaveBeenCalledWith('Email already taken', 'error');
  });

  it('shows backend message for 409 on register', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(
      createError({
        statusCode: 409,
        message: 'Email test@example.com is already in use',
      }),
      'register',
      showSnackbar,
    );
    expect(showSnackbar).toHaveBeenCalledWith(
      'Email test@example.com is already in use',
      'error',
    );
  });

  it('joins validation messages for 400 responses', () => {
    const showSnackbar = makeSnackbarSpy();
    const err = createError({
      statusCode: 400,
      message: 'Validation failed',
      body: { message: ['email is required', 'password is required'] },
    });
    handleFormError(err, 'register', showSnackbar);
    expect(showSnackbar).toHaveBeenCalledWith(
      'email is required · password is required',
      'error',
    );
  });

  it('shows timeout-warning for aborted requests', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(
      createError({ statusCode: 0, isAbort: true, message: 'timed out' }),
      'login',
      showSnackbar,
    );
    expect(showSnackbar).toHaveBeenCalledWith(
      'The request took too long. Check your connection.',
      'warning',
    );
  });

  it('shows generic server error for unexpected status codes', () => {
    const showSnackbar = makeSnackbarSpy();
    handleFormError(createError({ statusCode: 500 }), 'login', showSnackbar);
    expect(showSnackbar).toHaveBeenCalledWith(
      'Server error. Try again later.',
      'error',
    );
  });

  it('accepts custom translated strings', () => {
    const showSnackbar = makeSnackbarSpy();
    const customStrings = {
      generic: 'Custom generic',
      credentials: 'Custom credentials',
      timeout: 'Custom timeout',
      server: 'Custom server',
    };
    handleFormError(new Error('boom'), 'login', showSnackbar, customStrings);
    expect(showSnackbar).toHaveBeenCalledWith('Custom generic', 'error');
  });
});
