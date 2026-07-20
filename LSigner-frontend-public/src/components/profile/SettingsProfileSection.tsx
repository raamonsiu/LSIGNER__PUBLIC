'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { FilledButton, OutlineButton } from '@/components/ui';
import { SIDEBAR_WIDTH } from '@/components/layout/SideNav';
import type { AuthUser } from '@/lib/api/endpoints/types';
import {
  useProfileForm,
  SENSITIVE_FIELDS,
  FIELD_LABEL_KEYS,
} from './useProfileForm';

// === Component ================================================================

export function SettingsProfileSection({ user }: { user: AuthUser }) {
  const translations = useTranslations('profile');
  const [editAllActive, setEditAllActive] = useState(false);

  const form = useProfileForm(user, () => setEditAllActive(false));
  const styles = createStyles();

  // === beforeunload for browser-level navigation ======================

  useEffect(() => {
    if (form.hasChanges) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [form.hasChanges]);

  // === Handlers =======================================================

  function handleCancel() {
    if (form.hasChanges) {
      form.setConfirmCloseOpen(true);
    } else if (editAllActive) {
      setEditAllActive(false);
    }
  }

  function handleDiscardChanges() {
    form.handleDiscard();
    if (editAllActive) {
      setEditAllActive(false);
    }
  }

  // === Render helpers =================================================

  function renderField(field: string) {
    const isSensitive = SENSITIVE_FIELDS.has(field);
    const value = form.formValues[field as keyof typeof form.formValues] ?? '';
    const labelKey = FIELD_LABEL_KEYS[field] ?? field;

    const isEditing = editAllActive
      ? !isSensitive || form.verified
      : form.editingField === field;

    const displayValue = value || translations('not_available');

    return (
      <Box key={field} sx={styles.fieldRow}>
        <Typography variant="caption" sx={styles.fieldLabel}>
          {translations(labelKey)}
        </Typography>
        {isEditing ? (
          <TextField
            value={value}
            onChange={(e) => form.handleFieldChange(field, e.target.value)}
            onBlur={editAllActive ? undefined : form.handleFieldBlur}
            onKeyDown={editAllActive ? undefined : form.handleFieldKeyDown}
            size="small"
            fullWidth
            autoFocus={!editAllActive}
            variant="outlined"
            slotProps={{ input: { sx: styles.fieldInput } }}
          />
        ) : (
          <Box
            onClick={() => form.handleEditClick(field)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                form.handleEditClick(field);
              }
            }}
            role="button"
            tabIndex={0}
            sx={styles.fieldClickable}
          >
            {isSensitive && !form.verified ? (
              <Box sx={styles.lockedDisplay}>
                <LockOutlinedIcon sx={styles.lockIcon} />
                <Typography sx={styles.fieldValueLocked}>
                  {displayValue}
                </Typography>
              </Box>
            ) : (
              <Typography sx={styles.fieldValue}>{displayValue}</Typography>
            )}
          </Box>
        )}
      </Box>
    );
  }

  function renderAccountField(label: string, value: string) {
    return (
      <Box key={label} sx={styles.fieldRow}>
        <Typography variant="caption" sx={styles.fieldLabel}>
          {translations(label)}
        </Typography>
        <Typography sx={styles.fieldValue}>{value || '—'}</Typography>
      </Box>
    );
  }

  // === Render =========================================================

  return (
    <Box
      sx={{
        pb: editAllActive || form.hasChanges ? '80px' : 0,
      }}
    >
      {/* == Personal Information =================================== */}
      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Box sx={styles.sectionHeader}>
            <Typography sx={styles.sectionTitle}>
              {translations('personal_info')}
            </Typography>
            {!editAllActive && (
              <FilledButton size="small" onClick={() => setEditAllActive(true)}>
                {translations('edit_personal_data')}
              </FilledButton>
            )}
          </Box>
          {renderField('name')}
          {renderField('last_name')}
          {renderField('country')}
          {renderField('national_id')}
          {renderField('passport')}
        </CardContent>
      </Card>

      {/* == Contact Information ==================================== */}
      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Typography sx={styles.sectionTitle}>
            {translations('contact_info')}
          </Typography>
          {renderField('email')}
          {renderField('phone_number')}
        </CardContent>
      </Card>

      {/* == Account Information ==================================== */}
      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Typography sx={styles.sectionTitle}>
            {translations('account_info')}
          </Typography>
          {renderAccountField('patient_id', user.patient_id)}
          {renderAccountField('member_since', form.formatDate(user.created_at))}
          {renderAccountField('last_updated', form.formatDate(user.updated_at))}
        </CardContent>
      </Card>

      {/* == Bottom Bar ============================================= */}
      {(editAllActive || form.hasChanges) && (
        <Box sx={styles.bottomBar}>
          <OutlineButton onClick={handleCancel}>
            {translations('cancel')}
          </OutlineButton>
          <FilledButton
            onClick={form.handleSave}
            disabled={form.saving || !form.hasChanges}
          >
            {form.saving ? translations('saving') : translations('save')}
          </FilledButton>
        </Box>
      )}

      {/* == Verify Password Dialog ================================= */}
      <Dialog
        open={form.verifyOpen}
        onClose={() => form.setVerifyOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{translations('verify_title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {translations('verify_description', {
              field: form.pendingField
                ? translations(
                    FIELD_LABEL_KEYS[form.pendingField] ?? form.pendingField,
                  )
                : '',
            })}
          </DialogContentText>
          <TextField
            label={translations('verify_password_label')}
            type="password"
            value={form.verifyPassword}
            onChange={(e) => form.setVerifyPassword(e.target.value)}
            error={Boolean(form.verifyError)}
            helperText={form.verifyError}
            fullWidth
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <LockOutlinedIcon
                    sx={{ color: 'text.secondary', fontSize: 20, mr: 1 }}
                  />
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <OutlineButton onClick={() => form.setVerifyOpen(false)}>
            {translations('cancel')}
          </OutlineButton>
          <FilledButton onClick={form.handleVerifySubmit}>
            {translations('verify_button')}
          </FilledButton>
        </DialogActions>
      </Dialog>

      {/* == Unsaved Changes Dialog ================================= */}
      <Dialog
        open={form.confirmCloseOpen}
        onClose={() => form.setConfirmCloseOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{translations('unsaved_changes_title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {translations('unsaved_changes_message')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <OutlineButton onClick={() => form.setConfirmCloseOpen(false)}>
            {translations('keep_editing')}
          </OutlineButton>
          <FilledButton onClick={handleDiscardChanges}>
            {translations('discard')}
          </FilledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// === Styles ===================================================================

function createStyles() {
  return {
    card: {
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      mb: 2,
    } as const,
    cardContent: {
      p: '24px !important',
    } as const,
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 2,
    } as const,
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: 'text.secondary',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      mb: 1.5,
    } as const,
    fieldRow: {
      mb: 2,
    } as const,
    fieldLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: 'text.secondary',
      mb: 0.5,
      display: 'block',
    } as const,
    fieldValue: {
      fontSize: 14,
      fontWeight: 500,
      color: 'text.primary',
      lineHeight: 1.4,
      py: 1,
    } as const,
    fieldValueLocked: {
      fontSize: 14,
      fontWeight: 500,
      color: 'text.disabled',
      fontStyle: 'italic' as const,
      lineHeight: 1.4,
      py: 1,
    } as const,
    fieldClickable: {
      cursor: 'pointer',
      borderRadius: 1,
      transition: 'background-color 0.15s',
      '&:hover': { bgcolor: 'action.hover' },
    } as const,
    lockedDisplay: {
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
    } as const,
    lockIcon: {
      fontSize: 14,
      color: 'text.disabled',
      flexShrink: 0,
    } as const,
    fieldInput: {
      fontSize: 14,
      py: 0.5,
    } as const,
    bottomBar: {
      position: 'fixed',
      bottom: 0,
      left: SIDEBAR_WIDTH,
      right: 0,
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 1,
      px: 3,
      py: 2,
      borderTop: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
    } as const,
  };
}
