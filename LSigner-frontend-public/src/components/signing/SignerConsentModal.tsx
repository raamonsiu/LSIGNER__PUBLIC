'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { FilledButton } from '@/components/ui';
import type { DocumentActionType } from '@/lib/api/endpoints/types';

interface SignerConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentName: string;
  action: DocumentActionType | null;
}

/**
 * Pre-signing consent modal that replaces the former standalone
 * signer-consent legal document.
 *
 * Shown after the user clicks a signing action (SIGN / REJECT / REVOKE)
 * and before the OTP challenge begins. Requires the user to tick a
 * checkbox acknowledging legal validity before proceeding.
 */
export function SignerConsentModal({
  open,
  onClose,
  onConfirm,
  documentName,
  action,
}: SignerConsentModalProps) {
  const t = useTranslations('signer_consent');
  const [checked, setChecked] = useState(false);

  const handleClose = () => {
    setChecked(false);
    onClose();
  };

  const handleConfirm = () => {
    setChecked(false);
    onConfirm();
  };

  const titleKey =
    action === 'SIGN'
      ? 'title_sign'
      : action === 'REJECT'
        ? 'title_reject'
        : 'title_revoke';

  const bodyKeyP1 =
    action === 'SIGN'
      ? 'body_sign_p1'
      : action === 'REJECT'
        ? 'body_reject_p1'
        : 'body_revoke_p1';

  const bodyKeyP2 =
    action === 'SIGN'
      ? 'body_sign_p2'
      : action === 'REJECT'
        ? 'body_reject_p2'
        : 'body_revoke_p2';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{t(titleKey)}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {action ? t.rich(bodyKeyP1, { documentName }) : ''}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {action
            ? t.rich(bodyKeyP2, {
                policy: (chunks) => (
                  <Link
                    href="/legal/electronic-signature-policy"
                    style={{
                      color: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    {chunks}
                  </Link>
                ),
              })
            : ''}
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t('body_review')}
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {t('checkbox_label')}
            </Typography>
          }
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose}>{t('cancel')}</Button>
        <FilledButton onClick={handleConfirm} disabled={!checked}>
          {t('confirm')}
        </FilledButton>
      </DialogActions>
    </Dialog>
  );
}
