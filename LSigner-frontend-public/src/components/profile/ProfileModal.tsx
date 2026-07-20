'use client';

import { useTranslations } from 'next-intl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '@/lib/auth/AuthContext';
import { FilledButton, OutlineButton } from '@/components/ui';
import type { AuthUser } from '@/lib/api/endpoints/types';

// === Types ====================================================================

export interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onEditInfo: () => void;
}

// === Constants ================================================================

/**
 * Section -> field mapping matching SettingsProfileSection order.
 * `created_at` renders via the `member_since` i18n label,
 * `updated_at` renders via `last_updated`.
 */
const FIELD_GROUPS: Record<string, (keyof AuthUser)[]> = {
  personal_info: ['name', 'last_name', 'country', 'national_id', 'passport'],
  contact_info: ['email', 'phone_number'],
  account_info: ['patient_id', 'created_at', 'updated_at'],
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  name: 'first_name',
  last_name: 'last_name',
  patient_id: 'patient_id',
  email: 'email',
  phone_number: 'phone',
  country: 'country',
  national_id: 'national_id',
  passport: 'passport',
  created_at: 'member_since',
  updated_at: 'last_updated',
};

// === Helpers ==================================================================

function formatFieldValue(field: string, value: string | null): string {
  if (value === null) return '-'; //
  if (field === 'created_at' || field === 'updated_at') {
    return new Date(value).toLocaleDateString();
  }
  return value;
}

// === Component ================================================================

/**
 * Read-only profile modal triggered by clicking the avatar in TopBar.
 * Displays AuthUser fields grouped by section with an "Edit info" CTA.
 */
export function ProfileModal({ open, onClose, onEditInfo }: ProfileModalProps) {
  const translations = useTranslations('profile');
  const { user, isSessionRestored, logout } = useAuth();

  const initials = user ? `${user.name[0]}${user.last_name[0]}` : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="profile-modal-title"
    >
      {/* == Title bar with close button == */}
      <DialogTitle
        id="profile-modal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
        }}
      >
        <Box
          component="span"
          sx={{ fontWeight: 700, fontSize: 18, color: 'text.primary' }}
        >
          {translations('title')}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={translations('modal.close_aria')}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {!isSessionRestored ? (
          /* == Loading skeleton == */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Skeleton
              variant="circular"
              width={64}
              height={64}
              sx={{ alignSelf: 'center', mb: 1 }}
            />
            <Skeleton variant="text" width="60%" sx={{ alignSelf: 'center' }} />
            <Skeleton
              variant="text"
              width="40%"
              sx={{ alignSelf: 'center', mb: 2 }}
            />
            {[1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton variant="text" width="50%" sx={{ mb: 0.5 }} />
                <Skeleton
                  variant="rectangular"
                  height={20}
                  width="100%"
                  sx={{ borderRadius: 1 }}
                />
              </Box>
            ))}
          </Box>
        ) : user ? (
          /* == User content == */
          <>
            {/* Avatar + name header */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  mb: 1.5,
                  bgcolor: 'primary.main',
                  fontSize: 22,
                  fontWeight: 700,
                  border: '3px solid',
                  borderColor: 'divider',
                }}
              >
                {initials}
              </Avatar>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'text.primary',
                  textAlign: 'center',
                }}
              >
                {user.name} {user.last_name}
              </Typography>
            </Box>

            {/* Sectioned fields */}
            {Object.entries(FIELD_GROUPS).map(([sectionKey, fields]) => (
              <Box key={sectionKey} sx={{ mb: 2.5 }}>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    mb: 1.5,
                  }}
                >
                  {translations(sectionKey)}
                </Typography>

                {fields.map((field) => {
                  const rawValue = user[field as keyof AuthUser];
                  const value =
                    typeof rawValue === 'string'
                      ? (rawValue as string)
                      : rawValue === null || rawValue === undefined
                        ? null
                        : String(rawValue);
                  const labelKey = FIELD_LABEL_KEYS[field] ?? field;
                  const displayValue = formatFieldValue(field, value);

                  return (
                    <Box key={field} sx={{ mb: 1.75 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'text.secondary',
                          mb: 0.25,
                          display: 'block',
                        }}
                      >
                        {translations(labelKey)}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'text.primary',
                          lineHeight: 1.4,
                        }}
                      >
                        {displayValue}
                      </Typography>
                    </Box>
                  );
                })}

                {sectionKey !== 'account_info' && <Divider sx={{ mt: 0.5 }} />}
              </Box>
            ))}
          </>
        ) : null}
      </DialogContent>

      {/* == Edit info button == */}
      {isSessionRestored && user && (
        <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
          <OutlineButton onClick={logout} fullWidth>
            {translations('logout')}
          </OutlineButton>
          <FilledButton onClick={onEditInfo} fullWidth>
            {translations('edit_info')}
          </FilledButton>
        </DialogActions>
      )}
    </Dialog>
  );
}
