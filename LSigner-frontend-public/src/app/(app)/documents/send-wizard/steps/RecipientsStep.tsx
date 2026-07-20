'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ContactSearchAutocomplete } from '../components/ContactSearchAutocomplete';
import { RecipientRow } from '../components/RecipientRow';
import type { RecipientEntry } from '../components/ContactSearchAutocomplete';

// === Types ====================================================================

export interface WizardRecipient {
  email: string;
  name: string;
  contactId?: string;
  userId?: string;
  saveAsContact: boolean;
}

export interface RecipientsStepProps {
  onRecipientsChange: (recipients: WizardRecipient[]) => void;
  onError: (message: string) => void;
}

// === Component ================================================================

export function RecipientsStep({
  onRecipientsChange,
  onError,
}: RecipientsStepProps) {
  const t = useTranslations('send_wizard');
  const [recipients, setRecipients] = useState<WizardRecipient[]>([]);

  const notifyChange = useCallback(
    (updated: WizardRecipient[]) => {
      setRecipients(updated);
      onRecipientsChange(updated);
    },
    [onRecipientsChange],
  );

  const handleAddRecipient = useCallback(
    (entry: RecipientEntry | null) => {
      if (!entry || !entry.email) return;

      // Check for duplicates
      const isDuplicate = recipients.some(
        (recipient) => recipient.email.toLowerCase() === entry.email.toLowerCase(),
      );
      if (isDuplicate) {
        onError(t('recipients_duplicate'));
        return;
      }

      const newRecipient: WizardRecipient = {
        email: entry.email,
        name: entry.name,
        contactId: entry.contactId,
        userId: entry.userId,
        saveAsContact: false,
      };

      const updated = [...recipients, newRecipient];
      notifyChange(updated);
    },
    [recipients, notifyChange, onError, t],
  );

  const handleRemove = useCallback(
    (email: string) => {
      const updated = recipients.filter(
        (r) => r.email.toLowerCase() !== email.toLowerCase(),
      );
      notifyChange(updated);
    },
    [recipients, notifyChange],
  );

  const handleToggleSaveContact = useCallback(
    (email: string) => {
      const updated = recipients.map((recipient) =>
        recipient.email.toLowerCase() === email.toLowerCase()
          ? { ...recipient, saveAsContact: !recipient.saveAsContact }
          : recipient,
      );
      notifyChange(updated);
    },
    [recipients, notifyChange],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('recipients_title')}
      </Typography>

      <ContactSearchAutocomplete
        onChange={handleAddRecipient}
        placeholder={t('search_placeholder')}
        noOptionsText={t('search_no_options')}
        loadingText={t('search_loading')}
        clearText={t('search_clear')}
        closeText={t('search_close')}
        openText={t('search_open')}
        contactLabel={t('search_contact_label')}
        userLabel={t('search_user_label')}
      />

      {recipients.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}
        >
          {t('recipients_empty')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {recipients.map((recipient) => (
            <RecipientRow
              key={recipient.email}
              recipient={{
                email: recipient.email,
                name: recipient.name,
                contactId: recipient.contactId,
                userId: recipient.userId,
                type: recipient.contactId ? 'contact' : 'manual',
              }}
              saveAsContact={recipient.saveAsContact}
              onRemove={handleRemove}
              onToggleSaveContact={handleToggleSaveContact}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
