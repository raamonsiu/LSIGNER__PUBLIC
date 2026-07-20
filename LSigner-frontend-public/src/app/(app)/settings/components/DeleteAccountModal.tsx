'use client';

// Todo: Factor styles
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  error: string | null;
}

const DELETE_KEYWORD = 'confirmar';

export function DeleteAccountModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  error,
}: DeleteAccountModalProps) {
  const t = useTranslations('settings.dangerZone');
  const theme = useTheme();
  const [confirmationText, setConfirmationText] = useState('');

  const isKeywordMatched =
    confirmationText.trim().toLowerCase() === DELETE_KEYWORD;

  const handleClose = () => {
    if (!isLoading) {
      setConfirmationText('');
      onClose();
    }
  };

  const handleConfirm = () => {
    if (isKeywordMatched && !isLoading) {
      onConfirm();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && isKeywordMatched && !isLoading) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('confirmTitle')}</DialogTitle>

      <DialogContent>
        <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
          {t('description')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: theme.palette.chip.errorText,
            bgcolor: theme.palette.chip.errorBg,
          }}
        >
          <Typography
            sx={{
              color: theme.palette.chip.errorText,
              fontWeight: 700,
              fontSize: 13,
              mb: 1,
            }}
          >
            {t('confirmDescription')}
          </Typography>

          <TextField
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('confirmPlaceholder')}
            size="small"
            fullWidth
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: theme.palette.chip.errorText,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.chip.errorText,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.chip.errorText,
                  borderWidth: 2,
                },
              },
            }}
          />
        </Box>

        <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 2 }}>
          <Link
            href="/legal/document-retention-policy"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'underline' }}
          >
            {t('legalLinkLabel')}
          </Link>
          {' — '}
          {t('legalDescription')}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!isKeywordMatched || isLoading}
          sx={{
            bgcolor: theme.palette.chip.errorText,
            color: theme.palette.getContrastText(theme.palette.chip.errorText),
            '&:hover': {
              bgcolor: theme.palette.chip.errorText,
              opacity: 0.9,
            },
            '&.Mui-disabled': {
              bgcolor: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
            },
          }}
        >
          {t('confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
