'use client';
// ! IN PROGTRESS, NOT TESTED YET SO NOT DECLARED AS DONE IN PFG MEMORY
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { FilledButton } from '@/components/ui';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { API_BASE_URL } from '@/lib/api';
import { getPublicDocumentMeApi } from '@/lib/api/endpoints/public-documents';
import {
  bootstrapPublicSessionApi,
  logoutPublicSessionApi,
} from '@/lib/api/endpoints/public-session';
import {
  getPublicDocumentLocksApi,
  resolvePublicDocumentLockApi,
} from '@/lib/api/endpoints/document-locks';
import {
  createPublicOtpChallengeApi,
  resendPublicOtpApi,
  verifyPublicOtpApi,
} from '@/lib/api/endpoints/public-otp';
import type {
  DocumentActionType,
  PublicDocumentMeResponse,
  ReceivedDocumentStatus,
  SharedDocumentLockStatus,
} from '@/lib/api/endpoints/types';
import { ApiError } from '@/lib/api/core/errors';
import OtpVerificationDialog from '@/app/(app)/documents/received/components/OtpVerificationDialog';
import { SignerConsentModal } from '@/components/signing/SignerConsentModal';
import { useOtpAction } from '@/hooks/useOtpAction';

function getReadableStatus(status: ReceivedDocumentStatus): string {
  if (status === 'SIGNED') return 'SIGNED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'REVOKED') return 'REVOKED';
  return 'PENDING';
}

function formatFileSize(fileSizeInBytes: number): string {
  if (fileSizeInBytes < 1024) return `${fileSizeInBytes} B`;
  if (fileSizeInBytes < 1024 * 1024) {
    return `${(fileSizeInBytes / 1024).toFixed(1)} KB`;
  }
  return `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openUrlInNewTab(url: string): void {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (newWindow) {
    newWindow.opener = null;
  }
}

export default function PublicDocumentPage() {
  const router = useRouter();
  const params = useParams<{ publicLinkId: string }>();
  const { showSnackbar } = useSnackbar();
  const t = useTranslations('public_page');

  const publicLinkId = params?.publicLinkId ?? null;
  const [documentData, setDocumentData] =
    useState<PublicDocumentMeResponse | null>(null);
  const [locks, setLocks] = useState<SharedDocumentLockStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [currentAction, setCurrentAction] = useState<DocumentActionType | null>(
    null,
  );
  const [consentAction, setConsentAction] = useState<DocumentActionType | null>(
    null,
  );
  const [otpError, setOtpError] = useState<string | null>(null);

  const otpAction = useOtpAction({
    createChallenge: (action, resourceType, resourceId) =>
      createPublicOtpChallengeApi(action, resourceType, resourceId),
    resendOtp: (challengeId) => resendPublicOtpApi(challengeId),
    verifyOtp: (challengeId, code) => verifyPublicOtpApi(challengeId, code),
  });

  const loadPublicDocument = useCallback(async () => {
    if (!publicLinkId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const bootstrap = await bootstrapPublicSessionApi(publicLinkId);
      if (bootstrap.status === 'AUTH_REQUIRED') {
        showSnackbar(t('auth_required'), 'warning');
        router.replace('/login');
        return;
      }

      const [documentResponse, locksResponse] = await Promise.all([
        getPublicDocumentMeApi(),
        getPublicDocumentLocksApi(),
      ]);

      setDocumentData(documentResponse);
      setLocks(locksResponse);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        setErrorMessage(t('invalid_link'));
      } else if (error instanceof ApiError && error.statusCode === 403) {
        setErrorMessage(t('session_invalid'));
      } else {
        setErrorMessage(t('load_error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [publicLinkId, router, showSnackbar, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPublicDocument();
  }, [loadPublicDocument]);

  const unresolvedLocks = useMemo(
    () => locks.filter((lock) => !lock.is_resolved),
    [locks],
  );

  const currentStatus =
    documentData?.my_recipient.signing_status ??
    ('PENDING' as ReceivedDocumentStatus);

  const resolveAllLocks = useCallback(async () => {
    if (!unlockPassword || unresolvedLocks.length === 0) return;
    setIsUnlocking(true);
    try {
      for (const lock of unresolvedLocks) {
        await resolvePublicDocumentLockApi(lock.id, unlockPassword);
      }
      setUnlockPassword('');
      showSnackbar(t('unlocked_success'), 'success');
      await loadPublicDocument();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        showSnackbar(t('wrong_password'), 'error');
      } else {
        showSnackbar(t('resolve_locks_error'), 'error');
      }
    } finally {
      setIsUnlocking(false);
    }
  }, [loadPublicDocument, showSnackbar, t, unlockPassword, unresolvedLocks]);

  const startActionFlow = useCallback(
    async (action: DocumentActionType) => {
      if (!documentData) return;
      setCurrentAction(action);
      setOtpError(null);
      try {
        await otpAction.startAction(action, 'DOCUMENT', documentData.id);
      } catch {
        setCurrentAction(null);
        showSnackbar(t('start_flow_error'), 'error');
      }
    },
    [documentData, otpAction, showSnackbar, t],
  );

  const closeOtpFlow = useCallback(() => {
    setCurrentAction(null);
    setOtpError(null);
    otpAction.closeFlow();
    setConsentAction(null);
  }, [otpAction]);

  const handleResendOtp = useCallback(async () => {
    if (!otpAction.currentChallenge || !otpAction.canResendOtp) return;
    try {
      await otpAction.handleResend();
    } catch {
      setOtpError(t('resend_error'));
    }
  }, [otpAction, t]);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!otpAction.currentChallenge || !currentAction) return;
      setOtpError(null);
      try {
        const verification = await otpAction.handleVerify(code);
        const newStatus = verification.actionResult
          .newStatus as ReceivedDocumentStatus;
        setDocumentData((previousDocument) => {
          if (!previousDocument) return previousDocument;
          return {
            ...previousDocument,
            status: newStatus,
            my_recipient: {
              ...previousDocument.my_recipient,
              signing_status: newStatus,
            },
          };
        });
        showSnackbar(t('action_completed'), 'success');
        closeOtpFlow();
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 410) {
          setOtpError(t('code_expired'));
        } else if (error instanceof ApiError && error.statusCode === 422) {
          setOtpError(t('wrong_code'));
        } else {
          setOtpError(t('verify_error'));
        }
      }
    },
    [closeOtpFlow, currentAction, otpAction, showSnackbar, t],
  );

  const handleDownload = useCallback(() => {
    openUrlInNewTab(`${API_BASE_URL}/v1/public/documents/me/download`);
  }, []);

  if (isLoading) {
    return (
      <Container sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (errorMessage) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{errorMessage}</Alert>
      </Container>
    );
  }

  if (!documentData) {
    return null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
        >
          <CardContent>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {documentData.document_name}
                </Typography>
                <Chip
                  label={getReadableStatus(currentStatus)}
                  color={
                    currentStatus === 'SIGNED'
                      ? 'success'
                      : currentStatus === 'PENDING'
                        ? 'warning'
                        : 'default'
                  }
                />
              </Box>

              <Typography sx={{ color: 'text.secondary' }}>
                {t('sender_label')}:{' '}
                {documentData.sender_name ?? documentData.sender_email}
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                {t('file_label')}: {documentData.original_filename} ·{' '}
                {formatFileSize(documentData.file_size_bytes)}
              </Typography>

              {unresolvedLocks.length > 0 && (
                <Alert severity="warning">
                  {t('unresolved_locks', { count: unresolvedLocks.length })}
                </Alert>
              )}

              {unresolvedLocks.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label={t('document_password')}
                    type="password"
                    value={unlockPassword}
                    onChange={(event) => setUnlockPassword(event.target.value)}
                  />
                  <FilledButton
                    onClick={() => void resolveAllLocks()}
                    disabled={!unlockPassword || isUnlocking}
                  >
                    {isUnlocking ? t('unlocking') : t('unlock')}
                  </FilledButton>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={handleDownload}
                  disabled={unresolvedLocks.length > 0}
                >
                  {t('download')}
                </Button>
                {currentStatus === 'PENDING' && (
                  <>
                    <Button
                      variant="contained"
                      color="error"
                      disabled={unresolvedLocks.length > 0}
                      onClick={() => setConsentAction('REJECT')}
                    >
                      {t('reject')}
                    </Button>
                    <FilledButton
                      disabled={unresolvedLocks.length > 0}
                      onClick={() => setConsentAction('SIGN')}
                    >
                      {t('sign')}
                    </FilledButton>
                  </>
                )}
                {currentStatus === 'SIGNED' && (
                  <Button
                    variant="contained"
                    color="warning"
                    disabled={unresolvedLocks.length > 0}
                    onClick={() => setConsentAction('REVOKE')}
                  >
                    {t('revoke')}
                  </Button>
                )}
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    void logoutPublicSessionApi().finally(() => {
                      router.replace('/login');
                    });
                  }}
                >
                  {t('end_session')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Consent modal — appears before OTP challenge */}
      <SignerConsentModal
        open={consentAction !== null}
        onClose={() => setConsentAction(null)}
        onConfirm={() => {
          if (consentAction) {
            const action = consentAction;
            setConsentAction(null);
            void startActionFlow(action);
          }
        }}
        documentName={documentData.document_name}
        action={consentAction}
      />

      {otpAction.currentChallenge && (
        <OtpVerificationDialog
          open={Boolean(otpAction.currentChallenge)}
          onClose={closeOtpFlow}
          maskedDestination={otpAction.currentChallenge.maskedDestination}
          isVerifying={otpAction.isSubmitting}
          errorMessage={otpError}
          resendCooldown={otpAction.resendCooldown}
          canResend={otpAction.canResendOtp}
          onSubmit={handleVerifyOtp}
          onResend={() => void handleResendOtp()}
        />
      )}
    </Container>
  );
}
