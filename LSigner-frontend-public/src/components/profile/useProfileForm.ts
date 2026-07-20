'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { useLocaleContext } from '@/app/locale/LocaleContext';
import { updateUserApi } from '@/lib/api/endpoints/users';
import { handleFormError } from '@/lib/api/error-handler';
import { ApiError } from '@/lib/api/core/errors';
import type { AuthUser, UpdateUserDto } from '@/lib/api/endpoints/types';

// === Constants ================================================================

export const SENSITIVE_FIELDS = new Set(['email', 'phone_number']);

export const FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'first_name',
  last_name: 'last_name',
  country: 'country',
  national_id: 'national_id',
  passport: 'passport',
  email: 'email',
  phone_number: 'phone',
};

// === Hook ======================================================================

export function useProfileForm(user: AuthUser, onDone: () => void) {
  const translations = useTranslations('profile');
  const errorsTranslations = useTranslations('errors');
  const { updateUser } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { locale } = useLocaleContext();

  const initials = `${user.name[0]}${user.last_name[0]}`.toUpperCase();

  const [formValues, setFormValues] = useState({
    name: user.name ?? '',
    last_name: user.last_name ?? '',
    country: user.country ?? '',
    national_id: user.national_id ?? '',
    passport: user.passport ?? '',
    email: user.email ?? '',
    phone_number: user.phone_number ?? '',
  });
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const hasChanges = dirtyFields.size > 0;

  // === Handlers ==========================================================

  function handleFieldChange(field: string, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setDirtyFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  function handleEditClick(field: string) {
    if (SENSITIVE_FIELDS.has(field) && !verified) {
      setPendingField(field);
      setVerifyPassword('');
      setVerifyError('');
      setVerifyOpen(true);
      return;
    }
    setEditingField(field);
  }

  function handleFieldBlur() {
    setEditingField(null);
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setEditingField(null);
    }
  }

  function handleVerifySubmit() {
    if (!verifyPassword) {
      setVerifyError(translations('verify_password_required'));
      return;
    }
    setCurrentPassword(verifyPassword);
    setVerified(true);
    if (pendingField) {
      setEditingField(pendingField);
    }
    setVerifyOpen(false);
    setPendingField(null);
    setVerifyPassword('');
    setVerifyError('');
  }

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const dto: UpdateUserDto = {};
      if (user.patient_id) {
        dto.patient_id = user.patient_id;
      }
      let needsPassword = false;
      for (const field of dirtyFields) {
        const value = formValues[field as keyof typeof formValues] ?? '';
        if (field === 'national_id' || field === 'passport') {
          (dto as Record<string, string | null>)[field] = value || null;
        } else {
          (dto as Record<string, string>)[field] = value;
        }
        if (SENSITIVE_FIELDS.has(field)) needsPassword = true;
      }
      if (needsPassword && currentPassword) {
        dto.current_password = currentPassword;
      }
      const updated = await updateUserApi(dto);
      const merged: AuthUser = {
        ...user,
        ...(dto.name !== undefined ? { name: updated.name } : {}),
        ...(dto.last_name !== undefined
          ? { last_name: updated.last_name }
          : {}),
        ...(dto.country !== undefined ? { country: updated.country } : {}),
        ...(dto.national_id !== undefined
          ? { national_id: updated.national_id }
          : {}),
        ...(dto.passport !== undefined ? { passport: updated.passport } : {}),
        ...(dto.email !== undefined ? { email: updated.email } : {}),
        ...(dto.phone_number !== undefined
          ? { phone_number: updated.phone_number }
          : {}),
      };
      updateUser(merged);
      showSnackbar(translations('update_success'), 'success');
      setCurrentPassword('');
      setVerified(false);
      setDirtyFields(new Set());
      setEditingField(null);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        showSnackbar(translations('wrong_password'), 'error');
        setCurrentPassword('');
        setVerified(false);
        return;
      }
      handleFormError(err, 'register', showSnackbar, {
        generic: errorsTranslations('generic'),
        credentials: errorsTranslations('credentials'),
        timeout: errorsTranslations('timeout'),
        server: errorsTranslations('server'),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDirtyFields(new Set());
    setEditingField(null);
    setConfirmCloseOpen(false);
  }

  function handleConfirmClose() {
    setConfirmCloseOpen(false);
    onDone();
  }

  function formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(
      locale === 'en' ? 'en-US' : locale === 'ca' ? 'ca-ES' : 'es-ES',
      { year: 'numeric', month: 'short' },
    );
  }

  return {
    formValues,
    dirtyFields,
    editingField,
    setEditingField,
    saving,
    hasChanges,
    currentPassword,
    verified,
    initials,
    handleFieldChange,
    handleEditClick,
    handleFieldBlur,
    handleFieldKeyDown,
    handleVerifySubmit,
    handleSave,
    handleDiscard,
    handleConfirmClose,
    verifyOpen,
    setVerifyOpen,
    verifyPassword,
    setVerifyPassword,
    verifyError,
    setVerifyError,
    confirmCloseOpen,
    setConfirmCloseOpen,
    pendingField,
    formatDate,
  };
}
