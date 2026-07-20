'use client';

//TODO: Factor styles
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { FilledButton } from '@/components/ui';

interface OtpVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  maskedDestination: string;
  isVerifying: boolean;
  errorMessage: string | null;
  resendCooldown: number;
  canResend: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
}

export default function OtpVerificationDialog({
  open,
  onClose,
  maskedDestination,
  isVerifying,
  errorMessage,
  resendCooldown,
  canResend,
  onSubmit,
  onResend,
}: OtpVerificationDialogProps) {
  const t = useTranslations('received_documents.otp');
  const [code, setCode] = useState('');

  const handleSubmit = useCallback(() => {
    if (code.length >= 4) {
      onSubmit(code);
    }
  }, [code, onSubmit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      disableRestoreFocus
      key={`otp-dialog-${open}`}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <VerifiedUserIcon sx={{ fontSize: 22, color: 'primary.main' }} />
        {t('title')}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t.rich('description', {
            destination: maskedDestination,
            b: (chunks) => (
              <Typography
                component="span"
                key="dest"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {chunks}
              </Typography>
            ),
          })}
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
            {errorMessage}
          </Alert>
        )}

        <TextField
          fullWidth
          label={t('code_label')}
          placeholder={t('code_placeholder')}
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(val);
          }}
          disabled={isVerifying}
          autoFocus
          slotProps={{
            htmlInput: {
              inputMode: 'numeric',
              pattern: '[0-9]*',
              autoComplete: 'one-time-code',
            },
          }}
          sx={{ mb: 1 }}
        />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button
            size="small"
            onClick={onResend}
            disabled={!canResend || isVerifying}
            sx={{ fontSize: 12 }}
          >
            {canResend
              ? t('resend_button')
              : t('resend_available_in', { seconds: resendCooldown })}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={isVerifying}>
          {t('cancel_button')}
        </Button>
        <FilledButton
          onClick={handleSubmit}
          disabled={code.length < 4 || isVerifying}
        >
          {isVerifying ? t('verifying') : t('verify_button')}
        </FilledButton>
      </DialogActions>
    </Dialog>
  );
}
