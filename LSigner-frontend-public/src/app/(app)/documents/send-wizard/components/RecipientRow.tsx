'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import type { RecipientEntry } from './ContactSearchAutocomplete';

// === Props ====================================================================

export interface RecipientRowProps {
  recipient: RecipientEntry;
  onRemove: (email: string) => void;
  onToggleSaveContact: (email: string) => void;
  saveAsContact?: boolean;
}

// === Component ================================================================

export function RecipientRow({
  recipient,
  onRemove,
  onToggleSaveContact,
  saveAsContact = false,
}: RecipientRowProps) {
  const t = useTranslations('send_wizard');
  const isExistingContact = recipient.type === 'contact';

  const handleRemove = useCallback(() => {
    onRemove(recipient.email);
  }, [onRemove, recipient.email]);

  const handleToggleSave = useCallback(() => {
    onToggleSaveContact(recipient.email);
  }, [onToggleSaveContact, recipient.email]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {recipient.name || recipient.email}
          </Typography>
          {recipient.type === 'manual' && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', flexShrink: 0 }}
            >
              {t('recipient_type_manual')}
            </Typography>
          )}
        </Box>
        {recipient.name && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {recipient.email}
          </Typography>
        )}
      </Box>

      {!isExistingContact && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={saveAsContact}
              onChange={handleToggleSave}
              slotProps={{
                input: {
                  'aria-label': t('recipient_save_as_contact'),
                } as React.InputHTMLAttributes<HTMLInputElement>,
              }}
            />
          }
          label={
            <Typography variant="caption">
              {t('recipient_save_as_contact')}
            </Typography>
          }
          sx={{ mr: 0, flexShrink: 0 }}
        />
      )}

      <IconButton
        size="small"
        onClick={handleRemove}
        aria-label={t('recipient_remove', { email: recipient.email })}
        sx={{ flexShrink: 0 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
