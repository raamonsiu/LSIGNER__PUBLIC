/**
 * Shared error-handling utility for form submissions.
 *
 * Maps `ApiError` status codes to user-facing snackbar messages, reducing
 * duplication between login, register, and future form pages.
 *
 * All user-facing strings are received as pre-translated parameters so this
 * module has no i18n dependency (it is a pure utility function).
 */
import { ApiError } from '@/lib/api';

export type FormKind = 'login' | 'register';

export interface FormErrorStrings {
  generic: string;
  credentials: string;
  timeout: string;
  server: string;
}

export type ShowSnackbar = (
  message: string,
  severity: 'error' | 'warning' | 'info' | 'success',
) => void;

const DEFAULT_STRINGS: FormErrorStrings = {
  generic: 'Unexpected error. Try again.',
  credentials: 'Incorrect credentials. Check your email and password.',
  timeout: 'The request took too long. Check your connection.',
  server: 'Server error. Try again later.',
};

/**
 * Inspect an unknown error value and display the appropriate snackbar.
 *
 * @param err           Value caught in a `catch` block.
 * @param kind          Identifies the form so 401 / 409 branches differ.
 * @param showSnackbar  MUI snackbar trigger injected by the page.
 * @param strings       Pre-translated error messages (optional, uses English fallback).
 */
export function handleFormError(
  err: unknown,
  kind: FormKind,
  showSnackbar: ShowSnackbar,
  strings: FormErrorStrings = DEFAULT_STRINGS,
): void {
  if (!(err instanceof ApiError)) {
    showSnackbar(strings.generic, 'error');
    return;
  }

  if (kind === 'login' && err.statusCode === 401) {
    showSnackbar(strings.credentials, 'error');
    return;
  }

  if (kind === 'register' && err.statusCode === 409) {
    showSnackbar(err.message, 'error');
    return;
  }

  if (err.statusCode === 400) {
    const msgs = err.validationMessages;
    showSnackbar(msgs ? msgs.join(' · ') : err.message, 'error');
    return;
  }

  if (err.isAbort) {
    showSnackbar(strings.timeout, 'warning');
    return;
  }

  showSnackbar(strings.server, 'error');
}
