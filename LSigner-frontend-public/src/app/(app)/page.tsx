'use client';

// TODO: Factor styles in MUI/makestyles
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import DrawIcon from '@mui/icons-material/Draw';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { DragDropUpload } from '@/components/upload/DragDropUpload';
import { useWizard } from '@/components/providers/SendDocumentWizardProvider';
import { GhostButton } from '@/components/ui';
import { useReceivedDocumentDetail } from '@/hooks/useReceivedDocumentDetail';
import { fetchDownloadDataUrl } from '@/hooks/useReceivedDocumentDetail';
import { useSentDocumentDetail } from '@/hooks/useSentDocumentDetail';
import { useOtpAction } from '@/hooks/useOtpAction';
import { ApiError } from '@/lib/api/core/errors';
import {
  createOtpChallengeApi,
  resendOtpApi,
  verifyOtpApi,
} from '@/lib/api/endpoints/otp';
import { useLocaleContext } from '@/app/locale';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { formatRelativeDate } from '@/lib/i18n';
import { formatFileSize } from '@/lib/mock-data';
import DocumentPreviewDialog from './documents/received/components/DocumentPreviewDialog';
import OtpVerificationDialog from './documents/received/components/OtpVerificationDialog';
import { SignerConsentModal } from '@/components/signing/SignerConsentModal';
import type {
  DocumentActionType,
  ReceivedDocumentStatus,
} from '@/lib/api/endpoints/types';

import {
  useDashboardData,
  normalizeRecentItems,
  type DashboardRecentItem,
} from './hooks/useDashboardData';

// === Metric card =============================================================

function MetricCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  actionLabel,
  actionColor,
  onAction,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  actionLabel: string;
  actionColor: string;
  onAction?: () => void;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
      }}
    >
      <CardContent
        sx={{
          p: '20px !important',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
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
            fontSize: 48,
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1,
            mb: 'auto',
            pb: 2,
          }}
        >
          {String(value).padStart(2, '0')}
        </Typography>
        <Box
          component="button"
          onClick={onAction}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: actionColor,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            p: 0,
            textAlign: 'left',
            '&:hover': { opacity: 0.8 },
          }}
        >
          {actionLabel}
          <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

// === Security widget ==========================================================

function SecurityWidget({
  translations,
}: {
  translations: (key: string) => string;
}) {
  const theme = useTheme();
  const fg = theme.palette.primary.contrastText;
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        bgcolor: theme.palette.primary.main,
        borderRadius: 2,
        border: `1px solid ${alpha(fg, 0.08)}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CardContent
        sx={{
          p: '20px !important',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <VerifiedUserIcon sx={{ fontSize: 40, color: fg }} />
          <Box
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 10,
              border: `1px solid ${alpha(fg, 0.3)}`,
              bgcolor: alpha(fg, 0.12),
            }}
          >
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: fg,
                letterSpacing: 0.8,
              }}
            >
              {translations('dashboard.security.badge')}
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: 17, color: fg, mb: 0.75 }}>
          {translations('dashboard.security.title')}
        </Typography>
        <Typography
          sx={{
            fontSize: 13.5,
            color: alpha(fg, 0.75),
            mb: 'auto',
            pb: 2,
            lineHeight: 1.5,
          }}
        >
          {translations('dashboard.security.description')}
        </Typography>

        <Box>
          <LinearProgress
            variant="determinate"
            value={94}
            sx={{
              mb: 0.75,
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(fg, 0.12),
              '& .MuiLinearProgress-bar': { bgcolor: fg, borderRadius: 3 },
            }}
          />
          <Typography
            sx={{ fontSize: 11, color: alpha(fg, 0.8), fontWeight: 600 }}
          >
            94% {translations('dashboard.security.strength')}
          </Typography>
        </Box>
      </CardContent>

      <Box
        sx={{
          position: 'absolute',
          right: -40,
          bottom: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          bgcolor: alpha(fg, 0.07),
          filter: 'blur(24px)',
          pointerEvents: 'none',
        }}
      />
    </Card>
  );
}

// === Upload area =============================================================

function UploadArea({
  translations,
  onFileAccepted,
}: {
  translations: (key: string) => string;
  onFileAccepted: (file: File) => void;
}) {
  return (
    <Box sx={{ mb: 5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          {translations('dashboard.upload.title')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {translations('dashboard.upload.drag_hint')}
        </Typography>
      </Box>
      <DragDropUpload onFileAccepted={onFileAccepted} />
    </Box>
  );
}

// === Recent document row ======================================================

function RecentDocRow({
  item,
  t,
  onClick,
}: {
  item: DashboardRecentItem;
  t: (key: string) => string;
  onClick: () => void;
}) {
  const theme = useTheme();
  const { locale } = useLocaleContext();
  const now = new Date();

  const directionLabel =
    item.direction === 'sent'
      ? t('dashboard.recent_sent_label')
      : t('dashboard.recent_received_label');

  const directionColor =
    item.direction === 'sent'
      ? theme.palette.primary.main
      : (theme.palette.success?.main ?? theme.palette.primary.main);

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 2,
        transition: 'background-color 0.12s',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: theme.palette.action.hover,
        },
      }}
    >
      <Box
        sx={{
          p: 1,
          borderRadius: 1.5,
          bgcolor: theme.palette.nav.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <DescriptionOutlinedIcon
          sx={{ fontSize: 20, color: theme.palette.nav.iconColor }}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
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
          {item.documentName}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.otherParty} ·{' '}
          {formatRelativeDate(locale, new Date(item.date), now)}
          {item.fileSizeBytes > 0 && ` · ${formatFileSize(item.fileSizeBytes)}`}
        </Typography>
      </Box>

      <Chip
        label={directionLabel}
        size="small"
        sx={{
          flexShrink: 0,
          display: { xs: 'none', sm: 'inline-flex' },
          color: directionColor,
          bgcolor: alpha(directionColor, 0.1),
          fontSize: 11,
          fontWeight: 700,
          height: 22,
        }}
      />
    </Box>
  );
}

// === Stats skeletons ==========================================================

function StatsSkeleton() {
  return (
    <>
      <Skeleton variant="rectangular" sx={{ borderRadius: 2, height: 180 }} />
      <Skeleton variant="rectangular" sx={{ borderRadius: 2, height: 180 }} />
    </>
  );
}

// === Page =====================================================================

export default function DashboardPage() {
  const theme = useTheme();
  const t = useTranslations();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const { sentData, receivedData, loading, error, refetch } =
    useDashboardData();
  const { openWizard } = useWizard();

  const sentTranslations = useTranslations('sent_documents');
  const receivedTranslations = useTranslations('received_documents');

  // == Action flow state (preview -> confirm -> OTP) ==========================

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

  // == Status presentation (used by both modal and preview dialog) ==========

  function getStatusPresentation(status: ReceivedDocumentStatus) {
    const { chip } = theme.palette;
    if (status === 'PENDING') {
      return {
        label: receivedTranslations('status.pending'),
        color: chip.waitText,
        bg: chip.waitBg,
      };
    }
    if (status === 'SIGNED') {
      return {
        label: receivedTranslations('status.signed'),
        color: chip.successText,
        bg: chip.successBg,
      };
    }
    if (status === 'REVOKED') {
      return {
        label: receivedTranslations('status.revoked'),
        color: chip.errorText,
        bg: chip.errorBg,
      };
    }
    return {
      label: receivedTranslations('status.rejected'),
      color: chip.errorText,
      bg: chip.errorBg,
    };
  }

  // == Helpers ==============================================================

  function revokeBlobUrl(blobUrl: string | null): void {
    if (typeof window === 'undefined') return;
    if (!blobUrl || !blobUrl.startsWith('blob:')) return;
    URL.revokeObjectURL(blobUrl);
  }

  const clearActionPreviewUrl = useCallback(() => {
    setActionPreviewUrl((prev) => {
      revokeBlobUrl(prev);
      return '';
    });
  }, []);

  // == Stable callbacks for hooks (prevents useMemo defeat from inline arrows) ==

  // Ref pattern: startActionFlowWithPreview is defined after the hooks (circular dep).
  // The ref is synced post-definition; onStartActionFlow reads the latest via ref.
  const startActionFlowWithPreviewRef = useRef<
    ((action: DocumentActionType) => Promise<void>) | null
  >(null);

  const onStartActionFlow = useCallback((action: DocumentActionType) => {
    startActionFlowWithPreviewRef.current?.(action);
  }, []);

  const onAfterDelete = useCallback(() => {
    void refetch();
  }, [refetch]);

  // == Hooks ================================================================

  const receivedDetail = useReceivedDocumentDetail({
    t: receivedTranslations,
    formatFileSize,
    getStatusPresentation,
    onStartActionFlow,
  });

  const sentDetail = useSentDocumentDetail({
    showSnackbar,
    t: sentTranslations,
    onAfterDelete,
  });

  const {
    selectedDocument,
    closeDetail: closeReceivedDetail,
    openDocument,
    setIsDetailModalOpen: setReceivedIsDetailModalOpen,
    setActionFlowDocId: setReceivedActionFlowDocId,
    setPendingAction: setReceivedPendingAction,
    actionFlowDocId: receivedActionFlowDocId,
    pendingAction: receivedPendingAction,
  } = receivedDetail;

  // == Action flow handlers (must be after hook destructuring) ==============

  const closeActionFlow = useCallback(() => {
    clearActionPreviewUrl();
    setActionFlowStep('idle');
    setReceivedActionFlowDocId(null);
    setReceivedPendingAction(null);
    setOtpErrorMessage(null);
    setIsActionFlowing(false);
    otpAction.closeFlow();
  }, [
    clearActionPreviewUrl,
    otpAction,
    setReceivedActionFlowDocId,
    setReceivedPendingAction,
  ]);

  const handlePreviewAction = useCallback(
    async (action: DocumentActionType) => {
      if (!receivedActionFlowDocId || isActionFlowing) return;
      setIsActionFlowing(true);
      setOtpErrorMessage(null);
      setReceivedPendingAction(action);

      try {
        await otpAction.startAction(
          action,
          'DOCUMENT',
          receivedActionFlowDocId,
        );
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
      receivedActionFlowDocId,
      isActionFlowing,
      otpAction,
      showSnackbar,
      closeActionFlow,
      setReceivedPendingAction,
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
      if (
        !otpAction.currentChallenge ||
        !receivedActionFlowDocId ||
        !receivedPendingAction
      ) {
        return;
      }
      setOtpErrorMessage(null);

      const successMessage =
        receivedPendingAction === 'SIGN'
          ? receivedTranslations('otp.action_success_sign')
          : receivedPendingAction === 'REJECT'
            ? receivedTranslations('otp.action_success_reject')
            : receivedTranslations('otp.action_success_revoke');

      try {
        await otpAction.handleVerify(code);
        showSnackbar(successMessage, 'success');
        setReceivedPendingAction(null);
        otpAction.closeFlow();
        closeReceivedDetail();
        closeActionFlow();
        void refetch();
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 410) {
          setOtpErrorMessage(receivedTranslations('otp.expired_error'));
        } else if (err instanceof ApiError && err.statusCode === 422) {
          const remaining =
            (otpAction.currentChallenge?.remainingAttempts ?? 1) - 1;
          setOtpErrorMessage(
            receivedTranslations('otp.wrong_code', {
              remaining: String(remaining),
            }),
          );
        } else if (err instanceof ApiError && err.statusCode === 423) {
          setOtpErrorMessage(receivedTranslations('otp.too_many_attempts'));
        } else {
          setOtpErrorMessage(receivedTranslations('otp.verify_error'));
        }
      }
    },
    [
      otpAction,
      receivedActionFlowDocId,
      receivedPendingAction,
      receivedTranslations,
      showSnackbar,
      setReceivedPendingAction,
      closeReceivedDetail,
      closeActionFlow,
      refetch,
    ],
  );

  const startActionFlowWithPreview = useCallback(
    async (action: DocumentActionType) => {
      if (!selectedDocument || isActionFlowing) return;

      setIsActionFlowing(true);
      setReceivedActionFlowDocId(selectedDocument.id);
      setReceivedPendingAction(action);
      otpAction.closeFlow();
      setOtpErrorMessage(null);

      try {
        const previewUrl = await fetchDownloadDataUrl(selectedDocument.id);
        setActionPreviewUrl((prev) => {
          revokeBlobUrl(prev);
          return previewUrl;
        });
        setActionFlowStep('preview');
        setReceivedIsDetailModalOpen(false);
      } catch (error: unknown) {
        setReceivedActionFlowDocId(null);
        setReceivedPendingAction(null);
        otpAction.closeFlow();

        if (error instanceof Error) {
          if (error.message === 'PDF_TOO_LARGE_FOR_PREVIEW') {
            // window.open already fired from within fetchDownloadDataUrl :
            // close flow silently.
            return;
          }
        }

        showSnackbar(
          receivedTranslations('messages.open_document_error'),
          'error',
        );
      } finally {
        setIsActionFlowing(false);
      }
    },
    [
      isActionFlowing,
      selectedDocument,
      otpAction,
      showSnackbar,
      receivedTranslations,
      setReceivedActionFlowDocId,
      setReceivedPendingAction,
      setReceivedIsDetailModalOpen,
    ],
  );

  // Keep ref in sync so onStartActionFlow always calls the latest version
  useEffect(() => {
    startActionFlowWithPreviewRef.current = startActionFlowWithPreview;
  });

  // == Derived stats ========================================================

  const pendingSignatureCount = receivedData
    ? receivedData.items.filter((item) => item.status === 'PENDING').length
    : 0;
  const waitingForOthersCount = sentData
    ? sentData.items.filter((item) => item.signing_status === 'PENDING').length
    : 0;

  // == Derived recent docs ===================================================

  const recentDocs = useMemo(() => {
    if (!sentData || !receivedData) return [];
    return normalizeRecentItems(sentData.items, receivedData.items);
  }, [sentData, receivedData]);

  const isEmpty =
    !loading && !error && sentData && receivedData && recentDocs.length === 0;

  // == Navigation callbacks ==================================================

  const handleViewReceived = useCallback(() => {
    router.push('/documents/received');
  }, [router]);

  const handleViewSent = useCallback(() => {
    router.push('/documents/sent');
  }, [router]);

  // == Recent doc click handlers =============================================

  const { showDocument: showSentDoc } = sentDetail;
  const { showDocument: showRecvDoc } = receivedDetail;

  const handleRecentClick = useCallback(
    (item: DashboardRecentItem) => {
      if (item.direction === 'sent') {
        void showSentDoc(item.documentId, item.recipientEmail);
      } else {
        void showRecvDoc(item.documentId);
      }
    },
    [showSentDoc, showRecvDoc],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: '56px', px: { xs: 2, sm: 3 } }}>
      {/* == Bento grid == */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' },
          gap: 3,
          mb: 5,
        }}
      >
        <Box
          sx={{
            gridColumn: { xs: '1', md: '1 / 9' },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 3,
          }}
        >
          {error ? (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Alert
                severity="error"
                action={
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => {
                      void refetch();
                    }}
                  >
                    {t('dashboard.messages.retry')}
                  </Button>
                }
              >
                {t('dashboard.messages.load_error')}
              </Alert>
            </Box>
          ) : loading ? (
            <StatsSkeleton />
          ) : (
            <>
              <MetricCard
                icon={DrawIcon}
                iconColor={theme.palette.nav.iconColor}
                iconBg={theme.palette.nav.iconBg}
                label={t('dashboard.metrics.pending_signature')}
                value={pendingSignatureCount}
                actionLabel={t('dashboard.metrics.view_all')}
                actionColor={theme.palette.primary.main}
                onAction={handleViewReceived}
              />
              <MetricCard
                icon={HourglassEmptyIcon}
                iconColor={theme.palette.nav.iconColor}
                iconBg={theme.palette.nav.iconBg}
                label={t('dashboard.metrics.waiting_for_others')}
                value={waitingForOthersCount}
                actionLabel={t('dashboard.metrics.view_status')}
                actionColor={theme.palette.primary.main}
                onAction={handleViewSent}
              />
            </>
          )}
        </Box>

        <Box sx={{ gridColumn: { xs: '1', md: '9 / 13' } }}>
          <SecurityWidget translations={t} />
        </Box>
      </Box>

      {/* == Upload section == */}
      <UploadArea translations={t} onFileAccepted={openWizard} />

      {/* == Recent documents == */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: 'text.primary' }}
          >
            {t('dashboard.recent_documents')}
          </Typography>
          <GhostButton
            size="small"
            endIcon={<ChevronRightIcon sx={{ fontSize: 14 }} />}
            sx={{ fontWeight: 700, fontSize: 13 }}
            onClick={handleViewSent}
          >
            {t('dashboard.metrics.view_all')}
          </GhostButton>
        </Box>

        {error ? (
          <Alert
            severity="error"
            action={
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => {
                  void refetch();
                }}
              >
                {t('dashboard.messages.retry')}
              </Button>
            }
          >
            {t('dashboard.messages.load_error')}
          </Alert>
        ) : loading ? (
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
            {[...Array(5)].map((_, idx) => (
              <Box key={idx} sx={{ px: 2.5, py: 2 }}>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </Box>
            ))}
          </Card>
        ) : isEmpty ? (
          <Card
            elevation={0}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('dashboard.messages.empty')}
            </Typography>
          </Card>
        ) : (
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
            {recentDocs.map((doc, idx) => (
              <Box key={doc.id}>
                <RecentDocRow
                  item={doc}
                  t={t}
                  onClick={() => handleRecentClick(doc)}
                />
                {idx < recentDocs.length - 1 && <Divider />}
              </Box>
            ))}
          </Card>
        )}
      </Box>

      {/* == Detail modals (rendered by hooks) == */}
      {receivedDetail.detailModal}
      {sentDetail.detailModal}

      {/* == Preview dialog (received docs) == */}
      {selectedDocument && (
        <DocumentPreviewDialog
          open={
            actionFlowStep === 'preview' ||
            actionFlowStep === 'consent' ||
            actionFlowStep === 'otp'
          }
          onClose={closeActionFlow}
          documentName={selectedDocument.document_name}
          senderName={
            selectedDocument.sender.name ?? selectedDocument.sender.email
          }
          fileSize={formatFileSize(selectedDocument.file_size_bytes)}
          statusLabel={
            getStatusPresentation(selectedDocument.my_recipient.signing_status)
              .label
          }
          previewUrl={actionPreviewUrl}
          actionType={receivedPendingAction}
          isSubmitting={isActionFlowing}
          onAction={(action) => {
            setReceivedPendingAction(action);
            setActionFlowStep('consent');
          }}
          onDownload={() => void openDocument()}
        />
      )}

      {/* Consent modal : appears before OTP challenge */}
      {selectedDocument && (
        <SignerConsentModal
          open={actionFlowStep === 'consent'}
          onClose={() => {
            setActionFlowStep('preview');
          }}
          onConfirm={() => {
            if (receivedPendingAction) {
              void handlePreviewAction(receivedPendingAction);
            }
          }}
          documentName={selectedDocument.document_name}
          action={receivedPendingAction}
        />
      )}

      {/* == OTP dialog (received docs) == */}
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
