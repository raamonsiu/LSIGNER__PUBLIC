'use client';

// TODO: Factor styles
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
} from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTheme, type Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { FilledButton } from '@/components/ui';
import { useLocaleContext } from '@/app/locale';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import {
  getPrivateDocumentLocksApi,
  resolvePrivateDocumentLockApi,
} from '@/lib/api/endpoints/document-locks';
import {
  createOtpChallengeApi,
  resendOtpApi,
  verifyOtpApi,
} from '@/lib/api/endpoints/otp';
import { ApiError } from '@/lib/api/core/errors';
import DocumentPreviewDialog from './components/DocumentPreviewDialog';
import OtpVerificationDialog from './components/OtpVerificationDialog';
import { SignerConsentModal } from '@/components/signing/SignerConsentModal';
import type {
  DocumentActionType,
  ReceivedDocumentStatus,
  SharedDocumentLockStatus,
} from '@/lib/api/endpoints/types';
import { useOtpAction } from '@/hooks/useOtpAction';
import { useReceivedDocuments } from '@/hooks/useReceivedDocuments';
import { useReceivedDocumentDetail } from '@/hooks/useReceivedDocumentDetail';
import { fetchDownloadDataUrl } from '@/hooks/useReceivedDocumentDetail';
import { normalizePrivateDocumentLock } from './normalize-private-document-lock';

interface ReceivedDocumentsPageProps {
  initialDocumentId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(locale: string, isoDate: string): string {
  return new Date(isoDate).toLocaleString(
    locale === 'es' ? 'es-ES' : locale === 'ca' ? 'ca-ES' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );
}

function getStatusPresentation(
  status: ReceivedDocumentStatus,
  theme: Theme,
  translations: (key: string) => string,
) {
  const { chip } = theme.palette;
  if (status === 'PENDING') {
    return {
      label: translations('status.pending'),
      color: chip.waitText,
      bg: chip.waitBg,
    };
  }
  if (status === 'SIGNED') {
    return {
      label: translations('status.signed'),
      color: chip.successText,
      bg: chip.successBg,
    };
  }
  if (status === 'REVOKED') {
    return {
      label: translations('status.revoked'),
      color: chip.errorText,
      bg: chip.errorBg,
    };
  }
  return {
    label: translations('status.rejected'),
    color: chip.errorText,
    bg: chip.errorBg,
  };
}

function getBlockedPresentation(translations: (key: string) => string) {
  return {
    label: translations('status.blocked'),
    color: '#c62828',
    bg: 'rgba(198, 40, 40, 0.10)',
  };
}

function MetricCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: '20px !important' }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
          }}
        >
          <Icon sx={{ fontSize: 22, color: iconColor }} />
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: 'text.secondary',
            mb: 0.5,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 38,
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function ReceivedDocumentsPage({
  initialDocumentId,
}: ReceivedDocumentsPageProps) {
  const router = useRouter();
  const theme = useTheme();
  const translations = useTranslations('received_documents');
  const loginTranslations = useTranslations('login');
  const { locale } = useLocaleContext();
  const { showSnackbar } = useSnackbar();
  const hasAutoOpenedDocumentRef = useRef(false);

  // Composable hooks
  const {
    data: receivedDocumentsData,
    loading: loadingPage,
    error: pageError,
    sortedItems,
    docLockData,
    refreshDocuments,
    setDocLockData,
  } = useReceivedDocuments();

  // Refs for circular dependency: the hook's detailModal needs callbacks that
  // reference values returned by the hook itself (closeDetail, openDocument).
  const startActionFlowRef = useRef<(action: DocumentActionType) => void>(
    undefined!,
  );
  const openDocumentHandlerRef = useRef<() => void>(undefined!);

  const statusPresentationFn = useCallback(
    (status: ReceivedDocumentStatus) =>
      getStatusPresentation(status, theme, translations),
    [theme, translations],
  );

  const {
    selectedDocument: selectedDocumentDetail,
    actionFlowDocId,
    pendingAction,
    showDocument: showDocumentDetail,
    openDocument,
    setIsDetailModalOpen,
    setActionFlowDocId,
    setPendingAction,
    closeDetail,
    detailModal,
  } = useReceivedDocumentDetail({
    t: translations,
    formatFileSize,
    getStatusPresentation: statusPresentationFn,
    onStartActionFlow: (action) => {
      startActionFlowRef.current(action);
    },
    onOpenDocument: () => {
      openDocumentHandlerRef.current();
    },
  });

  // Lock state
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockingDocId, setUnlockingDocId] = useState<string | null>(null);
  const [unlockLocks, setUnlockLocks] = useState<SharedDocumentLockStatus[]>(
    [],
  );
  const [currentLockIndex, setCurrentLockIndex] = useState(0);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlockingSubmit, setIsUnlockingSubmit] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // Action flow (sign/reject/revoke)
  const [actionFlowStep, setActionFlowStep] = useState<
    'idle' | 'preview' | 'consent' | 'otp' | 'result'
  >('idle');
  const [isActionFlowing, setIsActionFlowing] = useState(false);
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const [actionPreviewUrl, setActionPreviewUrl] = useState('');

  const otpAction = useOtpAction({
    createChallenge: createOtpChallengeApi,
    resendOtp: resendOtpApi,
    verifyOtp: verifyOtpApi,
  });

  const closeDetailModal = closeDetail;

  const openUnlockModalForLocks = useCallback(
    (documentId: string, unresolvedLocks: SharedDocumentLockStatus[]) => {
      setUnlockingDocId(documentId);
      setUnlockLocks(unresolvedLocks);
      setCurrentLockIndex(0);
      setUnlockPassword('');
      setShowPassword(false);
      setUnlockError('');
      setIsUnlockingSubmit(false);
      setIsUnlockModalOpen(true);
    },
    [],
  );

  const handleOpenDocument = useCallback(async () => {
    if (!selectedDocumentDetail) return;

    try {
      await openDocument();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === 'DOWNLOAD_FAILED_401') {
          showSnackbar('Session expired. Please sign in again.', 'warning');
          router.replace('/login?reason=expired');
          return;
        }

        if (error.message === 'DOWNLOAD_FAILED_403') {
          try {
            const fetchedLocks = await getPrivateDocumentLocksApi(
              selectedDocumentDetail.id,
            );
            const normalizedLocks = fetchedLocks.map((lock) =>
              normalizePrivateDocumentLock(
                lock,
                selectedDocumentDetail.my_recipient.id,
                selectedDocumentDetail.my_recipient.recipient_email,
              ),
            );
            const unresolvedLocks = normalizedLocks.filter(
              (lock) => !lock.is_resolved,
            );

            if (unresolvedLocks.length > 0) {
              setDocLockData((previousLocksByDocumentId) => ({
                ...previousLocksByDocumentId,
                [selectedDocumentDetail.id]: {
                  locks: normalizedLocks,
                  isBlocked: true,
                  loading: false,
                },
              }));
              closeDetailModal();
              openUnlockModalForLocks(
                selectedDocumentDetail.id,
                unresolvedLocks,
              );
              return;
            }
          } catch {
            // ignore and fallback to generic forbidden message
          }

          showSnackbar(
            'You must resolve all document locks before opening this file.',
            'error',
          );
          return;
        }

        if (error.message === 'POPUP_BLOCKED') {
          showSnackbar(
            'Popup blocked by browser. Allow popups and try again.',
            'warning',
          );
          return;
        }
      }

      showSnackbar(translations('messages.open_document_error'), 'error');
    }
  }, [
    closeDetailModal,
    openDocument,
    openUnlockModalForLocks,
    router,
    selectedDocumentDetail,
    setDocLockData,
    showSnackbar,
    translations,
  ]);

  const handleDocumentClick = useCallback(
    (documentId: string) => {
      const lockState = docLockData[documentId];
      if (lockState?.isBlocked) {
        const unresolvedLocks = lockState.locks.filter((l) => !l.is_resolved);
        openUnlockModalForLocks(documentId, unresolvedLocks);
      } else {
        void showDocumentDetail(documentId);
      }
    },
    [docLockData, showDocumentDetail, openUnlockModalForLocks],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!initialDocumentId || hasAutoOpenedDocumentRef.current) return;
    if (loadingPage) return;

    const targetDocument = receivedDocumentsData?.items.find(
      (documentItem) => documentItem.id === initialDocumentId,
    );

    if (!targetDocument) {
      hasAutoOpenedDocumentRef.current = true;
      return;
    }

    const targetLockState = docLockData[initialDocumentId];
    const shouldWaitForLockStatus =
      targetDocument.status === 'PENDING' && !targetLockState;

    if (shouldWaitForLockStatus || targetLockState?.loading) return;

    hasAutoOpenedDocumentRef.current = true;
    handleDocumentClick(initialDocumentId);
  }, [
    initialDocumentId,
    loadingPage,
    receivedDocumentsData,
    docLockData,
    handleDocumentClick,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const closeUnlockModal = useCallback(() => {
    setIsUnlockModalOpen(false);
    setUnlockingDocId(null);
    setUnlockLocks([]);
    setCurrentLockIndex(0);
    setUnlockPassword('');
    setShowPassword(false);
    setUnlockError('');
    setIsUnlockingSubmit(false);
  }, []);

  const resetPasswordField = useCallback(() => {
    setUnlockPassword('');
    setShowPassword(false);
    setUnlockError('');
  }, []);

  const handleUnlockSubmit = useCallback(async () => {
    if (!unlockingDocId || !unlockPassword || isUnlockingSubmit) return;

    const lockState = docLockData[unlockingDocId];
    if (!lockState) return;

    const currentLock = unlockLocks[currentLockIndex];
    if (!currentLock) return;

    setIsUnlockingSubmit(true);
    setUnlockError('');

    try {
      await resolvePrivateDocumentLockApi(
        unlockingDocId,
        currentLock.id,
        unlockPassword,
      );

      // Check if there are more locks to resolve
      if (currentLockIndex + 1 < unlockLocks.length) {
        setCurrentLockIndex((prev) => prev + 1);
        resetPasswordField();
      } else {
        // All locks resolved
        closeUnlockModal();

        // Update cached lock state so the doc is no longer blocked
        setDocLockData((prev) => {
          const existing = prev[unlockingDocId];
          if (!existing) return prev;
          return {
            ...prev,
            [unlockingDocId]: {
              ...existing,
              isBlocked: false,
              locks: existing.locks.map((l) => ({
                ...l,
                is_resolved: true,
              })),
            },
          };
        });

        showSnackbar(translations('unlock.unlock_success'), 'success');
        void showDocumentDetail(unlockingDocId);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setUnlockError(translations('unlock.wrong_password'));
      } else if (err instanceof ApiError && err.statusCode === 409) {
        // Already resolved — skip to next
        if (currentLockIndex + 1 < unlockLocks.length) {
          setCurrentLockIndex((prev) => prev + 1);
          resetPasswordField();
        } else {
          closeUnlockModal();
          setDocLockData((prev) => {
            const existing = prev[unlockingDocId];
            if (!existing) return prev;
            return {
              ...prev,
              [unlockingDocId]: {
                ...existing,
                isBlocked: false,
                locks: existing.locks.map((l) => ({
                  ...l,
                  is_resolved: true,
                })),
              },
            };
          });
          showSnackbar(translations('unlock.unlock_success'), 'success');
          void showDocumentDetail(unlockingDocId);
        }
      } else {
        setUnlockError(translations('unlock.unlock_error'));
      }
    } finally {
      setIsUnlockingSubmit(false);
    }
  }, [
    unlockingDocId,
    unlockPassword,
    isUnlockingSubmit,
    docLockData,
    unlockLocks,
    currentLockIndex,
    translations,
    showSnackbar,
    showDocumentDetail,
    closeUnlockModal,
    resetPasswordField,
    setDocLockData,
  ]);

  // === Action flow handlers ==================================================

  function revokeBlobUrl(blobUrl: string | null): void {
    if (typeof window === 'undefined') return;
    if (!blobUrl || !blobUrl.startsWith('blob:')) return;
    URL.revokeObjectURL(blobUrl);
  }

  const clearActionPreviewUrl = useCallback(() => {
    setActionPreviewUrl((previousPreviewUrl) => {
      revokeBlobUrl(previousPreviewUrl);
      return '';
    });
  }, []);

  const closeActionFlow = useCallback(() => {
    clearActionPreviewUrl();
    setActionFlowStep('idle');
    setActionFlowDocId(null);
    setPendingAction(null);
    setOtpErrorMessage(null);
    setIsActionFlowing(false);
    otpAction.closeFlow();
  }, [clearActionPreviewUrl, otpAction, setActionFlowDocId, setPendingAction]);

  const refreshDocumentListAfterAction = useCallback(() => {
    closeDetailModal();
    closeActionFlow();
    void refreshDocuments();
  }, [closeDetailModal, closeActionFlow, refreshDocuments]);

  const handlePreviewAction = useCallback(
    async (action: DocumentActionType) => {
      if (!actionFlowDocId || isActionFlowing) return;
      setIsActionFlowing(true);
      setOtpErrorMessage(null);
      setPendingAction(action);

      try {
        await otpAction.startAction(action, 'DOCUMENT', actionFlowDocId);
        setActionFlowStep('otp');
      } catch {
        setOtpErrorMessage('Could not create verification. Try again.');
        showSnackbar(
          'Could not start verification. Make sure you are logged in.',
          'error',
        );
        closeActionFlow();
      } finally {
        setIsActionFlowing(false);
      }
    },
    [
      actionFlowDocId,
      isActionFlowing,
      setPendingAction,
      otpAction,
      showSnackbar,
      closeActionFlow,
    ],
  );

  const handleResendOtp = useCallback(async () => {
    if (!otpAction.currentChallenge || !otpAction.canResendOtp) return;
    setOtpErrorMessage(null);

    try {
      await otpAction.handleResend();
    } catch {
      setOtpErrorMessage('Could not resend code.');
    }
  }, [otpAction]);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!otpAction.currentChallenge || !actionFlowDocId || !pendingAction) {
        return;
      }
      setOtpErrorMessage(null);

      const successMessage =
        pendingAction === 'SIGN'
          ? translations('otp.action_success_sign')
          : pendingAction === 'REJECT'
            ? translations('otp.action_success_reject')
            : translations('otp.action_success_revoke');

      try {
        await otpAction.handleVerify(code);
        showSnackbar(successMessage, 'success');
        setActionFlowStep('idle');
        setPendingAction(null);
        otpAction.closeFlow();
        refreshDocumentListAfterAction();
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 410) {
          setOtpErrorMessage(translations('otp.expired_error'));
        } else if (err instanceof ApiError && err.statusCode === 422) {
          const remaining =
            (otpAction.currentChallenge?.remainingAttempts ?? 1) - 1;
          setOtpErrorMessage(
            translations('otp.wrong_code', { remaining: String(remaining) }),
          );
        } else if (err instanceof ApiError && err.statusCode === 423) {
          setOtpErrorMessage(translations('otp.too_many_attempts'));
        } else {
          setOtpErrorMessage(translations('otp.verify_error'));
        }
      }
    },
    [
      otpAction,
      actionFlowDocId,
      pendingAction,
      translations,
      showSnackbar,
      setPendingAction,
      refreshDocumentListAfterAction,
    ],
  );

  const startActionFlowWithPreview = useCallback(
    async (action: DocumentActionType) => {
      if (!selectedDocumentDetail || isActionFlowing) return;

      setIsActionFlowing(true);
      setActionFlowDocId(selectedDocumentDetail.id);
      setPendingAction(action);
      otpAction.closeFlow();
      setOtpErrorMessage(null);

      try {
        const previewUrl = await fetchDownloadDataUrl(
          selectedDocumentDetail.id,
        );
        setActionPreviewUrl((previousPreviewUrl) => {
          revokeBlobUrl(previousPreviewUrl);
          return previewUrl;
        });
        setActionFlowStep('preview');
        setIsDetailModalOpen(false);
      } catch (error: unknown) {
        setActionFlowDocId(null);
        setPendingAction(null);
        otpAction.closeFlow();

        if (error instanceof Error) {
          if (error.message === 'DOWNLOAD_FAILED_401') {
            showSnackbar(loginTranslations('expired_session'), 'warning');
            router.replace('/login?reason=expired');
            return;
          }

          if (error.message === 'DOWNLOAD_FAILED_403') {
            showSnackbar(translations('messages.resolve_locks_first'), 'error');
            return;
          }

          if (error.message === 'PDF_TOO_LARGE_FOR_PREVIEW') {
            // window.open already fired from within fetchDownloadDataUrl —
            // close flow silently.
            return;
          }
        }

        showSnackbar(translations('messages.open_document_error'), 'error');
      } finally {
        setIsActionFlowing(false);
      }
    },
    [
      isActionFlowing,
      loginTranslations,
      router,
      selectedDocumentDetail,
      showSnackbar,
      translations,
      setActionFlowDocId,
      setPendingAction,
      setIsDetailModalOpen,
      otpAction,
    ],
  );

  // Wire the circular refs after the callbacks are defined.
  useLayoutEffect(() => {
    startActionFlowRef.current = startActionFlowWithPreview;
    openDocumentHandlerRef.current = handleOpenDocument;
  });

  const stats = receivedDocumentsData?.stats;

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: '56px', px: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            xl: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 4,
        }}
      >
        {loadingPage && !stats ? (
          Array.from({ length: 4 }, (_, index) => (
            <Card
              key={`metric-skeleton-${index}`}
              elevation={0}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: '20px !important' }}>
                <Skeleton variant="rounded" width={42} height={42} />
                <Skeleton sx={{ mt: 2 }} width="70%" />
                <Skeleton sx={{ mt: 1 }} width={80} height={48} />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              icon={MoveToInboxIcon}
              iconColor={theme.palette.nav.iconColor}
              iconBg={theme.palette.nav.iconBg}
              label={translations('metrics.total_received')}
              value={stats?.total_received ?? 0}
            />
            <MetricCard
              icon={HourglassEmptyIcon}
              iconColor={theme.palette.nav.iconColor}
              iconBg={theme.palette.nav.iconBg}
              label={translations('metrics.pending_my_signature')}
              value={stats?.pending_my_signature ?? 0}
            />
            <MetricCard
              icon={CheckCircleIcon}
              iconColor={theme.palette.nav.iconColor}
              iconBg={theme.palette.nav.iconBg}
              label={translations('metrics.signed_by_me')}
              value={stats?.signed_by_me ?? 0}
            />
            <MetricCard
              icon={CancelOutlinedIcon}
              iconColor={theme.palette.nav.iconColor}
              iconBg={theme.palette.nav.iconBg}
              label={translations('metrics.rejected_or_revoked')}
              value={stats?.rejected_or_revoked ?? 0}
            />
          </>
        )}
      </Box>

      <Box>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}
        >
          {translations('list.title')}
        </Typography>

        <Card
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {loadingPage && !receivedDocumentsData ? (
            Array.from({ length: 6 }, (_, index) => (
              <Box key={`row-skeleton-${index}`}>
                <Box sx={{ px: 2.5, py: 2 }}>
                  <Skeleton width="42%" />
                  <Skeleton sx={{ mt: 0.7 }} width="78%" />
                </Box>
                {index < 5 && <Divider />}
              </Box>
            ))
          ) : pageError ? (
            <Box sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary', mb: 2 }}>
                {translations('messages.load_error')}
              </Typography>
              <FilledButton onClick={() => void refreshDocuments()}>
                {translations('messages.retry')}
              </FilledButton>
            </Box>
          ) : sortedItems.length === 0 ? (
            <Box sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary' }}>
                {translations('messages.empty')}
              </Typography>
            </Box>
          ) : (
            sortedItems.map((documentItem, index) => {
              const statusPresentation = getStatusPresentation(
                documentItem.status,
                theme,
                translations,
              );

              const lockState = docLockData[documentItem.id];
              const isOnBlockedCheck =
                documentItem.status === 'PENDING' && lockState?.loading;
              const isBlocked = lockState?.isBlocked ?? false;
              const blockedPresentation = getBlockedPresentation(translations);

              return (
                <Box key={documentItem.id}>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => handleDocumentClick(documentItem.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleDocumentClick(documentItem.id);
                      }
                    }}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      px: 2.5,
                      py: 2,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(280px, 1.8fr) repeat(4, minmax(120px, 1fr)) auto',
                      },
                      gap: { xs: 1.5, md: 1 },
                      alignItems: 'center',
                      transition: 'background-color 0.12s',
                      cursor: 'pointer',
                      bgcolor: isBlocked
                        ? 'rgba(183, 28, 28, 0.04)'
                        : 'transparent',
                      borderLeft: isBlocked
                        ? '3px solid'
                        : '3px solid transparent',
                      borderColor: isBlocked ? 'error.main' : 'transparent',
                      '&:hover': {
                        bgcolor: isBlocked
                          ? 'rgba(183, 28, 28, 0.08)'
                          : theme.palette.action.hover,
                        '& .row-action': { opacity: 1 },
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: -2,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        minWidth: 0,
                      }}
                    >
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: isBlocked
                            ? 'rgba(198, 40, 40, 0.10)'
                            : theme.palette.nav.iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isBlocked ? (
                          <LockOutlinedIcon
                            sx={{ fontSize: 20, color: 'error.main' }}
                          />
                        ) : (
                          <DescriptionOutlinedIcon
                            sx={{
                              fontSize: 20,
                              color: theme.palette.nav.iconColor,
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {documentItem.document_name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary' }}
                        >
                          {translations('fields.size')}:{' '}
                          {formatFileSize(documentItem.file_size_bytes)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          display: 'block',
                        }}
                      >
                        {translations('fields.received_at')}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12.5, color: 'text.primary' }}
                      >
                        {formatDateTime(locale, documentItem.received_at)}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          display: 'block',
                        }}
                      >
                        {translations('fields.signed_at')}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12.5, color: 'text.primary' }}
                      >
                        {documentItem.signed_at
                          ? formatDateTime(locale, documentItem.signed_at)
                          : documentItem.expires_at
                            ? `${translations('fields.expires')} ${formatDateTime(locale, documentItem.expires_at)}`
                            : translations('messages.not_signed')}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          display: 'block',
                        }}
                      >
                        {translations('fields.sender')}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12.5, color: 'text.primary' }}
                      >
                        {documentItem.sender_name ?? documentItem.sender_email}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 700,
                          display: 'block',
                        }}
                      >
                        {translations('fields.status')}
                      </Typography>
                      {isBlocked ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.25,
                            py: 0.4,
                            borderRadius: 10,
                            bgcolor: blockedPresentation.bg,
                            color: blockedPresentation.color,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                          }}
                        >
                          <LockOutlinedIcon sx={{ fontSize: 13 }} />
                          {blockedPresentation.label.toUpperCase()}
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 1.25,
                            py: 0.4,
                            borderRadius: 10,
                            bgcolor: statusPresentation.bg,
                            color: statusPresentation.color,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                          }}
                        >
                          {statusPresentation.label.toUpperCase()}
                        </Box>
                      )}
                      {isOnBlockedCheck && (
                        <CircularProgress
                          size={12}
                          sx={{ ml: 1, verticalAlign: 'middle' }}
                        />
                      )}
                    </Box>

                    <Box
                      className="row-action"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: { xs: 1, md: 0 },
                        transition: 'opacity 0.12s',
                      }}
                    >
                      <ChevronRightIcon
                        sx={{ fontSize: 18, color: 'text.secondary' }}
                      />
                    </Box>
                  </Box>

                  {index < sortedItems.length - 1 && <Divider />}
                </Box>
              );
            })
          )}
        </Card>
      </Box>

      {/* Unlock modal */}
      <Dialog
        open={isUnlockModalOpen}
        onClose={closeUnlockModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 22, color: 'error.main' }} />
          {translations('unlock.title')}
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {translations('unlock.description')}
          </Typography>

          {unlockLocks.length > 1 && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}
            >
              {translations('unlock.step_label', {
                current: currentLockIndex + 1,
                total: unlockLocks.length,
              })}
            </Typography>
          )}

          {unlockLocks.length > 1 && (
            <LinearProgress
              variant="determinate"
              value={(currentLockIndex / unlockLocks.length) * 100}
              sx={{ mb: 2, borderRadius: 1 }}
            />
          )}

          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                display: 'block',
                mb: 0.5,
              }}
            >
              {translations('unlock.lock_password')}
            </Typography>
          </Box>

          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            placeholder={translations('unlock.password_placeholder')}
            value={unlockPassword}
            onChange={(e) => {
              setUnlockPassword(e.target.value);
              if (unlockError) setUnlockError('');
            }}
            error={!!unlockError}
            helperText={unlockError}
            disabled={isUnlockingSubmit}
            autoFocus
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={closeUnlockModal} disabled={isUnlockingSubmit}>
            {translations('modal.close')}
          </Button>
          <FilledButton
            onClick={() => void handleUnlockSubmit()}
            disabled={!unlockPassword || isUnlockingSubmit}
          >
            {isUnlockingSubmit
              ? translations('unlock.unlocking')
              : translations('unlock.unlock_button')}
          </FilledButton>
        </DialogActions>
      </Dialog>

      {detailModal}

      {/* Preview dialog */}
      {selectedDocumentDetail && (
        <DocumentPreviewDialog
          open={
            actionFlowStep === 'preview' ||
            actionFlowStep === 'consent' ||
            actionFlowStep === 'otp'
          }
          onClose={closeActionFlow}
          documentName={selectedDocumentDetail.document_name}
          senderName={
            selectedDocumentDetail.sender.name ??
            selectedDocumentDetail.sender.email
          }
          fileSize={formatFileSize(selectedDocumentDetail.file_size_bytes)}
          statusLabel={
            getStatusPresentation(
              selectedDocumentDetail.my_recipient.signing_status,
              theme,
              translations,
            ).label
          }
          previewUrl={actionPreviewUrl}
          actionType={pendingAction}
          isSubmitting={isActionFlowing}
          onAction={(action) => {
            setPendingAction(action);
            setActionFlowStep('consent');
          }}
          onDownload={() => void handleOpenDocument()}
        />
      )}

      {/* Consent modal — appears before OTP challenge */}
      {selectedDocumentDetail && (
        <SignerConsentModal
          open={actionFlowStep === 'consent'}
          onClose={() => {
            setActionFlowStep('preview');
          }}
          onConfirm={() => {
            if (pendingAction) {
              void handlePreviewAction(pendingAction);
            }
          }}
          documentName={selectedDocumentDetail.document_name}
          action={pendingAction}
        />
      )}

      {/* OTP dialog */}
      <OtpVerificationDialog
        open={actionFlowStep === 'otp'}
        onClose={closeActionFlow}
        maskedDestination={
          otpAction.currentChallenge?.maskedDestination ?? '***'
        }
        isVerifying={otpAction.isSubmitting}
        errorMessage={otpErrorMessage}
        resendCooldown={otpAction.resendCooldown}
        canResend={otpAction.canResendOtp}
        onSubmit={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </Container>
  );
}
