'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { UploadStep } from './steps/UploadStep';
import { MetadataStep } from './steps/MetadataStep';
import { RecipientsStep } from './steps/RecipientsStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { updateDocumentApi } from '@/lib/api/endpoints/documents';
import { sendDocumentApi } from '@/lib/api/endpoints/documents';
import { createContactApi } from '@/lib/api/endpoints/contacts';
import type { WizardRecipient } from './steps/RecipientsStep';

// === Types ====================================================================

export interface SendDocumentWizardProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

const TOTAL_STEPS = 4;

// === Component ================================================================

export function SendDocumentWizard({
  open,
  onClose,
  onSent,
}: SendDocumentWizardProps) {
  const t = useTranslations('send_wizard');
  const { showSnackbar } = useSnackbar();
  const [step, setStep] = useState(1);
  const [documentId, setDocumentId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipients, setRecipients] = useState<WizardRecipient[]>([]);
  const [sending, setSending] = useState(false);

  const handleError = useCallback(
    (message: string) => {
      showSnackbar(message, 'error');
    },
    [showSnackbar],
  );

  const handleUploaded = useCallback(
    (docId: string, _file: File, docTitle: string) => {
      setDocumentId(docId);
      setTitle(docTitle);
      setDescription('');
      setStep(2);
    },
    [],
  );

  const handleRecipientsChange = useCallback(
    (newRecipients: WizardRecipient[]) => {
      setRecipients(newRecipients);
    },
    [],
  );

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      await sendDocumentApi(documentId, {
        recipients: recipients.map((r) => ({
          recipient_email: r.email,
          recipient_name: r.name || undefined,
          user_id: r.userId,
        })),
      });

      // Create contacts for recipients with saveAsContact flag
      for (const recipient of recipients) {
        if (recipient.saveAsContact) {
          try {
            await createContactApi({
              contact_email: recipient.email,
              contact_name: recipient.name || undefined,
              contact_user_id: recipient.userId,
            });
          } catch {
            // Contact creation failure shouldn't block the flow
          }
        }
      }

      showSnackbar(t('send_success'), 'success');
      onSent();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('confirm_send_fail');
      handleError(message);
    } finally {
      setSending(false);
    }
  }, [documentId, recipients, handleError, showSnackbar, onSent, onClose, t]);

  const handleNext = useCallback(async () => {
    if (step === 2) {
      try {
        await updateDocumentApi(documentId, { title, description });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('metadata_save_fail');
        handleError(message);
        return; // stay on step 2
      }
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  }, [step, documentId, title, description, handleError, t]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      disableRestoreFocus
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {t('step_label', { step, total: TOTAL_STEPS })}
      </DialogTitle>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ mx: 3, mb: 1, height: 6, borderRadius: 3 }}
      />

      <DialogContent dividers>
        {step === 1 && (
          <UploadStep
            onDocumentUploaded={handleUploaded}
            onError={handleError}
          />
        )}

        {step === 2 && (
          <MetadataStep
            documentId={documentId}
            initialTitle={title}
            initialDescription={description}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
          />
        )}

        {step === 3 && (
          <RecipientsStep
            onRecipientsChange={handleRecipientsChange}
            onError={handleError}
          />
        )}

        {step === 4 && (
          <ConfirmStep
            title={title}
            description={description}
            recipients={recipients}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose}>{t('cancel')}</Button>

        <Box sx={{ flex: 1 }} />

        {step > 1 && (
          <Button onClick={handleBack} disabled={step <= 1}>
            {t('back')}
          </Button>
        )}

        {step < 4 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={step === 3 && recipients.length === 0}
          >
            {t('next')}
          </Button>
        )}

        {step === 4 && (
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sending || recipients.length === 0}
            color="primary"
          >
            {sending ? (
              <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
            ) : null}
            {sending ? t('confirm_sending') : t('confirm_send')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
