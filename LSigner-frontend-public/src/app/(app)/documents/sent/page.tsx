'use client';

// TODO: Refacotr styles
// TODO: Refactor file, is too big
import { useCallback, useEffect, useState, type ElementType } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme, type Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FilledButton } from '@/components/ui';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import { useWizard } from '@/components/providers/SendDocumentWizardProvider';
import { useLocaleContext } from '@/app/locale';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { getSentRecipientsApi } from '@/lib/api/endpoints/documents';
import { useSentDocumentDetail } from '@/hooks/useSentDocumentDetail';
import type {
  RecipientSigningStatus,
  SentRecipientListItem,
  SentRecipientsListResponse,
  SentRecipientsStats,
} from '@/lib/api/endpoints/types';

function mapLocaleToIntlLocale(locale: string): string {
  if (locale === 'es') return 'es-ES';
  if (locale === 'ca') return 'ca-ES';
  return 'en-US';
}

function formatDateTime(locale: string, isoDate: string): string {
  return new Date(isoDate).toLocaleString(mapLocaleToIntlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getRecipientStatusChip(
  status: RecipientSigningStatus,
  theme: Theme,
  translations: (key: string) => string,
) {
  const { chip } = theme.palette;
  if (status === 'PENDING') {
    return {
      label: translations('recipient_status.pending'),
      color: chip.waitText,
      bg: chip.waitBg,
    };
  }
  if (status === 'SIGNED') {
    return {
      label: translations('recipient_status.signed'),
      color: chip.successText,
      bg: chip.successBg,
    };
  }
  // REJECTED or REVOKED
  return {
    label:
      status === 'REJECTED'
        ? translations('recipient_status.rejected')
        : translations('recipient_status.revoked'),
    color: chip.errorText,
    bg: chip.errorBg,
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

export default function SentDocumentsPage() {
  const theme = useTheme();
  const translations = useTranslations('sent_documents');
  const dashboardTranslations = useTranslations('dashboard');
  const { locale } = useLocaleContext();
  const { showSnackbar } = useSnackbar();

  const [sentRecipientsData, setSentRecipientsData] =
    useState<SentRecipientsListResponse | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingDetailDocumentId, setLoadingDetailDocumentId] = useState<
    string | null
  >(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const { openWizard, closeCount } = useWizard();

  const loadSentRecipients = useCallback(async () => {
    setLoadingPage(true);
    setPageError(null);
    try {
      const response = await getSentRecipientsApi();
      setSentRecipientsData(response);
    } catch {
      setPageError(translations('messages.load_error'));
    } finally {
      setLoadingPage(false);
    }
  }, [translations]);

  // Reload recipients when the wizard closes (after a successful send).
  useEffect(() => {
    if (closeCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSentRecipients();
    }
  }, [closeCount, loadSentRecipients]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSentRecipients() {
      try {
        const response = await getSentRecipientsApi();
        if (cancelled) return;
        setSentRecipientsData(response);
      } catch {
        if (cancelled) return;
        setPageError(translations('messages.load_error'));
      } finally {
        if (cancelled) return;
        setLoadingPage(false);
      }
    }

    void loadInitialSentRecipients();

    return () => {
      cancelled = true;
    };
  }, [translations]);

  const sentDetail = useSentDocumentDetail({
    showSnackbar,
    t: translations,
    onAfterDelete: loadSentRecipients,
  });

  const items: SentRecipientListItem[] = sentRecipientsData?.items ?? [];
  const stats: SentRecipientsStats | undefined = sentRecipientsData?.stats;

  const handleRecipientClick = useCallback(
    async (item: SentRecipientListItem) => {
      setLoadingDetailDocumentId(item.document_id);
      try {
        await sentDetail.showDocument(item.document_id, item.recipient_email);
      } finally {
        setLoadingDetailDocumentId(null);
      }
    },
    // sentDetail.showDocument is stable (memoized by the hook).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: '56px', px: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          {translations('list.title')}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(5, 1fr)',
          },
          gap: 2,
          mb: 4,
        }}
      >
        {loadingPage && !stats ? (
          Array.from({ length: 5 }, (_, index) => (
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
              label={translations('metrics.total')}
              value={stats?.total ?? 0}
            />
            <MetricCard
              icon={HourglassEmptyIcon}
              iconColor={theme.palette.chip.waitText}
              iconBg={theme.palette.chip.waitBg}
              label={translations('metrics.pending')}
              value={stats?.pending ?? 0}
            />
            <MetricCard
              icon={CheckCircleIcon}
              iconColor={theme.palette.chip.successText}
              iconBg={theme.palette.chip.successBg}
              label={translations('metrics.signed')}
              value={stats?.signed ?? 0}
            />
            <MetricCard
              icon={CancelOutlinedIcon}
              iconColor={theme.palette.chip.errorText}
              iconBg={theme.palette.chip.errorBg}
              label={translations('metrics.rejected')}
              value={stats?.rejected ?? 0}
            />
            <MetricCard
              icon={CancelOutlinedIcon}
              iconColor={theme.palette.chip.errorText}
              iconBg={theme.palette.chip.errorBg}
              label={translations('metrics.revoked')}
              value={stats?.revoked ?? 0}
            />
          </>
        )}
      </Box>

      <Box>
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
          {loadingPage && !sentRecipientsData ? (
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
                {pageError}
              </Typography>
              <FilledButton onClick={() => void loadSentRecipients()}>
                {translations('messages.retry')}
              </FilledButton>
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ px: 2.5, py: 5, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary' }}>
                {translations('messages.empty')}
              </Typography>
            </Box>
          ) : (
            items.map((item, index) => {
              const statusChip = getRecipientStatusChip(
                item.signing_status,
                theme,
                translations,
              );

              return (
                <Box key={`${item.document_id}-${item.recipient_email}`}>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleRecipientClick(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleRecipientClick(item);
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
                        md: 'minmax(280px, 1.8fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(170px, 1.5fr) minmax(100px, 0.8fr) auto',
                      },
                      gap: { xs: 1.5, md: 1 },
                      alignItems: 'center',
                      transition: 'background-color 0.12s',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: theme.palette.action.hover,
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
                          bgcolor: theme.palette.nav.iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionOutlinedIcon
                          sx={{
                            fontSize: 20,
                            color: theme.palette.nav.iconColor,
                          }}
                        />
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
                          {item.recipient_name ?? item.recipient_email}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary' }}
                        >
                          {item.document_name}
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
                        {translations('fields.sent_at')}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12.5, color: 'text.primary' }}
                      >
                        {formatDateTime(locale, item.sent_at)}
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
                        {item.signed_at
                          ? formatDateTime(locale, item.signed_at)
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
                        {translations('fields.recipient_email')}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12.5, color: 'text.primary' }}
                      >
                        {item.recipient_email}
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
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          px: 1.25,
                          py: 0.4,
                          borderRadius: 10,
                          bgcolor: statusChip.bg,
                          color: statusChip.color,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                        }}
                      >
                        {statusChip.label.toUpperCase()}
                      </Box>
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
                      {loadingDetailDocumentId === item.document_id ? (
                        <CircularProgress size={18} />
                      ) : (
                        <ChevronRightIcon
                          sx={{ fontSize: 18, color: 'text.secondary' }}
                        />
                      )}
                    </Box>
                  </Box>

                  {index < items.length - 1 && <Divider />}
                </Box>
              );
            })
          )}
        </Card>
      </Box>

      {sentDetail.detailModal}

      {/* == Upload FAB + Wizard == */}
      <Fab
        color="primary"
        aria-label={dashboardTranslations('upload.title')}
        onClick={openWizard}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
}
