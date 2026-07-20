'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Avatar from '@mui/material/Avatar';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { FilledButton, OutlineButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  useProfileForm,
  SENSITIVE_FIELDS,
  FIELD_LABEL_KEYS,
} from './useProfileForm';

// === Constants ================================================================

const DRAWER_WIDTH = 400;

// === Inner form component : fully re-mounts on key change ====================

function ProfileFormContent({
  user,
  onDone,
}: {
  user: UserFromAuth;
  onDone: () => void;
}) {
  const translations = useTranslations('profile');
  const topbarTranslations = useTranslations('topbar');

  const form = useProfileForm(user, onDone);
  const styles = createStyles();

  function handleDrawerClose() {
    if (form.hasChanges) {
      form.setConfirmCloseOpen(true);
    } else {
      onDone();
    }
  }

  // === Render helpers ====================================================

  function renderField(field: string, value: string) {
    const isSensitive = SENSITIVE_FIELDS.has(field);
    const isEditing = form.editingField === field;
    const labelKey = FIELD_LABEL_KEYS[field] ?? field;
    const displayValue = value || translations('not_available');
    const showLock = isSensitive && !form.verified;

    return (
      <Box key={field} sx={styles.fieldRow}>
        <Typography variant="caption" sx={styles.fieldLabel}>
          {translations(labelKey)}
        </Typography>
        <Box sx={styles.fieldValueRow}>
          {isEditing ? (
            <TextField
              value={
                form.formValues[field as keyof typeof form.formValues] ?? ''
              }
              onChange={(e) => form.handleFieldChange(field, e.target.value)}
              onBlur={form.handleFieldBlur}
              onKeyDown={form.handleFieldKeyDown}
              size="small"
              fullWidth
              autoFocus
              variant="outlined"
              slotProps={{
                input: { sx: styles.fieldInput },
              }}
            />
          ) : (
            <Box sx={styles.fieldDisplayRow}>
              <Typography
                sx={{
                  ...styles.fieldValue,
                  ...(isSensitive && !form.verified
                    ? styles.sensitiveField
                    : {}),
                }}
              >
                {showLock ? (
                  <LockOutlinedIcon sx={styles.lockIcon} />
                ) : (
                  displayValue
                )}
              </Typography>
              <IconButton
                size="small"
                onClick={() => form.handleEditClick(field)}
                sx={styles.editButton}
                aria-label={translations('edit')}
              >
                <EditOutlinedIcon sx={styles.editIcon} />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  function renderAccountField(label: string, value: string) {
    return (
      <Box key={label} sx={styles.fieldRow}>
        <Typography variant="caption" sx={styles.fieldLabel}>
          {translations(label)}
        </Typography>
        <Typography sx={styles.fieldValue}>{value || ':'}</Typography>
      </Box>
    );
  }

  // === Render ============================================================

  return (
    <>
      <Box sx={styles.header}>
        <Typography variant="h6" sx={styles.headerTitle}>
          {translations('title')}
        </Typography>
        <IconButton onClick={handleDrawerClose} size="small" edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider />

      <Box sx={styles.content}>
        <Box sx={styles.avatarSection}>
          <Avatar sx={styles.avatar}>{form.initials}</Avatar>
          <Typography sx={styles.userName}>
            {user.name} {user.last_name}
          </Typography>
          <Typography sx={styles.userPlan}>
            {topbarTranslations('pro_account')}
          </Typography>
        </Box>

        <Typography sx={styles.sectionTitle}>
          {translations('personal_info')}
        </Typography>
        {renderField('name', form.formValues.name)}
        {renderField('last_name', form.formValues.last_name)}
        {renderField('country', form.formValues.country)}
        {renderField('national_id', form.formValues.national_id ?? '')}
        {renderField('passport', form.formValues.passport ?? '')}

        <Divider sx={{ my: 2.5 }} />

        <Typography sx={styles.sectionTitle}>
          {translations('contact_info')}
        </Typography>
        {renderField('email', form.formValues.email)}
        {renderField('phone_number', form.formValues.phone_number)}

        <Divider sx={{ my: 2.5 }} />

        <Typography sx={styles.sectionTitle}>
          {translations('account_info')}
        </Typography>
        {renderAccountField('patient_id', user.patient_id)}
        {renderAccountField('member_since', form.formatDate(user.created_at))}
        {renderAccountField('last_updated', form.formatDate(user.updated_at))}
      </Box>

      {form.hasChanges && (
        <Box sx={styles.bottomBar}>
          <OutlineButton onClick={form.handleDiscard}>
            {translations('cancel')}
          </OutlineButton>
          <FilledButton onClick={form.handleSave} disabled={form.saving}>
            {form.saving ? translations('saving') : translations('save')}
          </FilledButton>
        </Box>
      )}

      {/* == Verify Password Dialog ===================================== */}
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

      {/* == Unsaved Changes Dialog ==================================== */}
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
          <FilledButton onClick={form.handleConfirmClose}>
            {translations('discard')}
          </FilledButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

// === Outer drawer wrapper : manages re-mount key =============================

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

type UserFromAuth = NonNullable<ReturnType<typeof useAuth>['user']>;

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const styles = createStyles();
  const { user } = useAuth();

  const [sessionKey, setSessionKey] = useState(0);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSessionKey((key) => key + 1);
    }
    prevOpenRef.current = open;
  }, [open]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { invisible: false } }}
    >
      <Box sx={styles.drawer}>
        {user && (
          <ProfileFormContent key={sessionKey} user={user} onDone={onClose} />
        )}
      </Box>
    </Drawer>
  );
}

// === Styles ===================================================================

function createStyles() {
  return {
    drawer: {
      width: DRAWER_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: 'background.paper',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2.5,
      py: 1.75,
      flexShrink: 0,
    },
    headerTitle: {
      fontWeight: 700,
      fontSize: 18,
      color: 'text.primary',
    },
    content: {
      flex: 1,
      overflowY: 'auto',
      px: 2.5,
      py: 2,
      '&::-webkit-scrollbar': { display: 'none' },
      scrollbarWidth: 'none',
    },
    avatarSection: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      mb: 3,
    },
    avatar: {
      width: 64,
      height: 64,
      mb: 1.5,
      bgcolor: 'primary.main',
      fontSize: 22,
      fontWeight: 700,
      border: '3px solid',
      borderColor: 'divider',
    },
    userName: {
      fontWeight: 700,
      fontSize: 16,
      color: 'text.primary',
      textAlign: 'center',
    },
    userPlan: {
      fontSize: 12,
      fontWeight: 600,
      color: 'text.secondary',
      textAlign: 'center',
      mt: 0.25,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: 'text.secondary',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      mb: 1.5,
      mt: 0.5,
    },
    fieldRow: {
      mb: 1.75,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: 'text.secondary',
      mb: 0.25,
      display: 'block',
    },
    fieldValueRow: {
      display: 'flex',
      alignItems: 'center',
    },
    fieldDisplayRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
      minHeight: 40,
    },
    fieldValue: {
      fontSize: 14,
      fontWeight: 500,
      color: 'text.primary',
      lineHeight: 1.4,
    },
    sensitiveField: {
      color: 'text.disabled',
      fontStyle: 'italic' as const,
    },
    lockIcon: {
      fontSize: 14,
      color: 'text.disabled',
      verticalAlign: 'middle',
      mr: 0.5,
    },
    editButton: {
      color: 'text.disabled',
      p: 0.5,
      '&:hover': { color: 'primary.main' },
    },
    editIcon: {
      fontSize: 18,
    },
    fieldInput: {
      fontSize: 14,
      py: 0.5,
    },
    bottomBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 1,
      px: 2.5,
      py: 2,
      borderTop: '1px solid',
      borderColor: 'divider',
      flexShrink: 0,
      bgcolor: 'background.paper',
    },
  } as const;
}
