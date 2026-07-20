'use client';

import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import type { WizardRecipient } from './RecipientsStep';

// === Props ====================================================================

export interface ConfirmStepProps {
  title: string;
  description: string;
  recipients: WizardRecipient[];
}

// === Component ================================================================

export function ConfirmStep({
  title,
  description,
  recipients,
}: ConfirmStepProps) {
  const t = useTranslations('send_wizard');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('confirm_title')}
      </Typography>

      <Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
          {t('confirm_document_label')}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>

      <Divider />

      <Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
          {recipients.length === 1
            ? t('confirm_recipients_single', { count: recipients.length })
            : t('confirm_recipients_multi', { count: recipients.length })}
        </Typography>
        {recipients.map((recipient) => (
          <Box key={recipient.email} sx={{ py: 0.25 }}>
            <Typography variant="body2">
              {recipient.name && <strong>{recipient.name}</strong>}
              {recipient.name && ' — '}
              {recipient.email}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
