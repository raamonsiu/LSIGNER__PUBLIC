'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import {
  deleteSentDocumentSharedAccessApi,
  fetchDocumentDownloadBlobUrl,
  getSentDocumentByIdApi,
  sendSentDocumentReminderApi,
} from '@/lib/api/endpoints/documents';
import { ApiError } from '@/lib/api';
import type {
  SentDocumentDetailResponse,
  SentDocumentRecipient,
} from '@/lib/api/endpoints/types';

interface UseSentDocumentDetailOptions {
  /** Called to show a snackbar message (success/error). */
  showSnackbar: (
    message: string,
    severity: 'success' | 'error' | 'warning',
  ) => void;
  /** Translation function for sent_documents namespace. */
  t: (key: string, params?: Record<string, string>) => string;
  /** Called after a successful delete to refresh data. */
  onAfterDelete?: () => void;
}

interface UseSentDocumentDetailReturn {
  selectedDocumentDetail: SentDocumentDetailResponse | null;
  isDetailModalOpen: boolean;
  isModalDetailLoading: boolean;
  isReminderLoading: boolean;
  isDeleteLoading: boolean;
  isOpenDocumentLoading: boolean;
  showDeleteConfirmation: boolean;
  deleteConfirmationText: string;
  selectedRecipientEmail: string | null;
  selectedRecipient: SentDocumentRecipient | null;
  canSendReminder: boolean;
  canDeleteSharedAccess: boolean;
  deleteConfirmationKeyword: string;
  isDeleteKeywordMatched: boolean;
  showDocument: (
    documentId: string,
    recipientEmail: string | null,
  ) => Promise<void>;
  closeDetail: () => void;
  handleOpenDocument: () => Promise<void>;
  handleSendReminder: () => Promise<void>;
  handleDeleteSharedAccess: () => Promise<void>;
  setDeleteConfirmationText: (text: string) => void;
  setShowDeleteConfirmation: (show: boolean) => void;
  /** Rendered detail modal JSX, or null when modal is closed. */
  detailModal: React.JSX.Element | null;
}

/**
 * Hook that manages sent document detail loading, viewing, reminder, and
 * delete-shared-access state for the sent document detail modal.
 *
 * Also returns a `detailModal` JSX element that renders the complete dialog
 * internally : pages just render `{detailModal}`.
 */
export function useSentDocumentDetail(
  options: UseSentDocumentDetailOptions,
): UseSentDocumentDetailReturn {
  const theme = useTheme();
  const { showSnackbar, t, onAfterDelete } = options;
  const router = useRouter();
  const detailCacheRef = useRef<Map<string, SentDocumentDetailResponse>>(
    new Map(),
  );

  const [selectedDocumentDetail, setSelectedDocumentDetail] =
    useState<SentDocumentDetailResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState<
    string | null
  >(null);
  const [isModalDetailLoading, setIsModalDetailLoading] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isOpenDocumentLoading, setIsOpenDocumentLoading] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // == Derived ==============================================================

  const selectedRecipient: SentDocumentRecipient | null =
    selectedDocumentDetail?.recipients.find(
      (r) => r.recipient_email === selectedRecipientEmail,
    ) ?? null;

  const canSendReminder = selectedRecipient?.signing_status === 'PENDING';
  const canDeleteSharedAccess = selectedRecipient?.signing_status === 'PENDING';
  const deleteConfirmationKeyword = t('modal.delete_keyword');
  const isDeleteKeywordMatched =
    deleteConfirmationText.trim().toLowerCase() ===
    deleteConfirmationKeyword.trim().toLowerCase();

  // == Actions ==============================================================

  const showDocument = useCallback(
    async (documentId: string, recipientEmail: string | null) => {
      setIsDetailModalOpen(true);
      setShowDeleteConfirmation(false);
      setDeleteConfirmationText('');
      setSelectedRecipientEmail(recipientEmail);

      const cachedDetail = detailCacheRef.current.get(documentId);
      if (cachedDetail) {
        setSelectedDocumentDetail(cachedDetail);
        return;
      }

      setIsModalDetailLoading(true);
      setSelectedDocumentDetail(null);
      try {
        const detail = await getSentDocumentByIdApi(documentId);
        detailCacheRef.current.set(documentId, detail);
        setSelectedDocumentDetail(detail);
      } catch {
        showSnackbar(t('messages.detail_prefetch_failed'), 'warning');
        setIsDetailModalOpen(false);
      } finally {
        setIsModalDetailLoading(false);
      }
    },
    [showSnackbar, t],
  );

  const closeDetail = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedDocumentDetail(null);
    setSelectedRecipientEmail(null);
    setShowDeleteConfirmation(false);
    setDeleteConfirmationText('');
    setIsModalDetailLoading(false);
  }, []);

  const handleOpenDocument = useCallback(async () => {
    if (!selectedDocumentDetail || isOpenDocumentLoading) return;

    setIsOpenDocumentLoading(true);
    try {
      const blob = await fetchDocumentDownloadBlobUrl(
        selectedDocumentDetail.id,
      );
      const blobUrl = URL.createObjectURL(blob);
      const openedWindow = window.open(blobUrl, '_blank');
      if (!openedWindow) {
        showSnackbar(t('messages.popup_blocked'), 'warning');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'DOWNLOAD_FAILED_401') {
        showSnackbar(t('messages.session_expired'), 'warning');
        router.replace('/login?reason=expired');
        return;
      }
      showSnackbar(t('messages.open_document_error'), 'error');
    } finally {
      setIsOpenDocumentLoading(false);
    }
  }, [selectedDocumentDetail, showSnackbar, t, router, isOpenDocumentLoading]);

  const handleSendReminder = useCallback(async () => {
    if (!selectedDocumentDetail || !selectedRecipient || !canSendReminder)
      return;

    setIsReminderLoading(true);
    try {
      await sendSentDocumentReminderApi(
        selectedDocumentDetail.id,
        selectedRecipient.id,
      );
      showSnackbar(t('messages.reminder_sent'), 'success');
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        showSnackbar(error.message, 'error');
      } else {
        showSnackbar(t('messages.reminder_error'), 'error');
      }
    } finally {
      setIsReminderLoading(false);
    }
  }, [
    canSendReminder,
    selectedDocumentDetail,
    selectedRecipient,
    showSnackbar,
    t,
  ]);

  const handleDeleteSharedAccess = useCallback(async () => {
    if (
      !selectedDocumentDetail ||
      !selectedRecipient ||
      !canDeleteSharedAccess ||
      !isDeleteKeywordMatched
    ) {
      return;
    }

    setIsDeleteLoading(true);
    try {
      await deleteSentDocumentSharedAccessApi(
        selectedDocumentDetail.id,
        selectedRecipient.id,
      );
      showSnackbar(t('messages.document_deleted_shared'), 'success');
      detailCacheRef.current.delete(selectedDocumentDetail.id);
      closeDetail();
      onAfterDelete?.();
    } catch (error) {
      if (error instanceof ApiError) {
        showSnackbar(error.message, 'error');
      } else {
        showSnackbar(t('messages.delete_error'), 'error');
      }
    } finally {
      setIsDeleteLoading(false);
    }
  }, [
    canDeleteSharedAccess,
    closeDetail,
    isDeleteKeywordMatched,
    onAfterDelete,
    selectedDocumentDetail,
    selectedRecipient,
    showSnackbar,
    t,
  ]);

  // == Detail modal JSX =====================================================

  const detailModal = useMemo<React.JSX.Element | null>(() => {
    if (!isDetailModalOpen) return null;

    return (
      <Dialog open onClose={closeDetail} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          {t('modal.title')}
          <Button
            variant="text"
            onClick={() => void handleOpenDocument()}
            disabled={
              isModalDetailLoading ||
              !selectedDocumentDetail ||
              isOpenDocumentLoading
            }
            aria-label={t('modal.view_document')}
            sx={{ fontWeight: 700 }}
          >
            {isOpenDocumentLoading
              ? t('modal.opening_document')
              : t('modal.view_document')}
          </Button>
        </DialogTitle>

        <DialogContent dividers>
          {isModalDetailLoading || !selectedDocumentDetail ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>
                  {selectedDocumentDetail.document_name}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography
                    component="button"
                    type="button"
                    onClick={() => void handleOpenDocument()}
                    aria-label={t('modal.view_document')}
                    sx={{
                      border: 0,
                      background: 'transparent',
                      p: 0,
                      m: 0,
                      fontSize: 12,
                      color: 'primary.main',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: 700,
                      '&:hover': { opacity: 0.85 },
                    }}
                  >
                    {selectedDocumentDetail.original_filename}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    ·
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.recipient')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRecipient?.recipient_name ??
                      selectedRecipient?.recipient_email ??
                      '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.recipient_email')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRecipient?.recipient_email ?? '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.sent_at')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {new Date(
                      selectedDocumentDetail.sent_at,
                    ).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.signed_at')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRecipient?.signed_at
                      ? new Date(
                          selectedRecipient.signed_at,
                        ).toLocaleDateString()
                      : t('messages.not_signed')}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.status')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {selectedRecipient
                      ? selectedRecipient.signing_status === 'PENDING'
                        ? t('recipient_status.pending')
                        : selectedRecipient.signing_status === 'SIGNED'
                          ? t('recipient_status.signed')
                          : selectedRecipient.signing_status === 'REJECTED'
                            ? t('recipient_status.rejected')
                            : t('recipient_status.revoked')
                      : '-'}
                  </Typography>
                </Box>
              </Box>

              {!canDeleteSharedAccess && selectedRecipient ? (
                <Alert severity="info" variant="outlined">
                  {t('modal.delete_not_allowed')}
                </Alert>
              ) : null}

              {showDeleteConfirmation ? (
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
                    {t('modal.delete_warning')}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.5 }}
                  >
                    {t('modal.type_delete_instruction', {
                      keyword: deleteConfirmationKeyword,
                    })}
                  </Typography>
                  <TextField
                    value={deleteConfirmationText}
                    onChange={(event) =>
                      setDeleteConfirmationText(event.target.value)
                    }
                    placeholder={deleteConfirmationKeyword}
                    size="small"
                    fullWidth
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
              ) : null}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDetail}>{t('modal.close')}</Button>

          {canSendReminder && (
            <Button
              variant="outlined"
              onClick={() => void handleSendReminder()}
              disabled={
                isModalDetailLoading || !canSendReminder || isReminderLoading
              }
            >
              {isReminderLoading
                ? t('modal.sending_reminder')
                : t('modal.send_reminder')}
            </Button>
          )}

          {showDeleteConfirmation ? (
            <Button
              variant="contained"
              onClick={() => void handleDeleteSharedAccess()}
              disabled={
                isModalDetailLoading ||
                isDeleteLoading ||
                !isDeleteKeywordMatched ||
                !canDeleteSharedAccess
              }
              sx={{
                bgcolor: theme.palette.chip.errorText,
                color: theme.palette.getContrastText(
                  theme.palette.chip.errorText,
                ),
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
              {isDeleteLoading
                ? t('modal.deleting')
                : t('modal.confirm_delete')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={isModalDetailLoading || !canDeleteSharedAccess}
              sx={{
                bgcolor: theme.palette.chip.errorText,
                color: theme.palette.getContrastText(
                  theme.palette.chip.errorText,
                ),
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
              {t('modal.delete_document')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  }, [
    isDetailModalOpen,
    isModalDetailLoading,
    selectedDocumentDetail,
    isOpenDocumentLoading,
    selectedRecipient,
    canSendReminder,
    canDeleteSharedAccess,
    deleteConfirmationKeyword,
    isDeleteKeywordMatched,
    deleteConfirmationText,
    showDeleteConfirmation,
    isReminderLoading,
    isDeleteLoading,
    closeDetail,
    handleOpenDocument,
    handleSendReminder,
    handleDeleteSharedAccess,
    setDeleteConfirmationText,
    setShowDeleteConfirmation,
    t,
    theme,
  ]);

  return {
    selectedDocumentDetail,
    isDetailModalOpen,
    isModalDetailLoading,
    isReminderLoading,
    isDeleteLoading,
    isOpenDocumentLoading,
    showDeleteConfirmation,
    deleteConfirmationText,
    selectedRecipientEmail,
    selectedRecipient,
    canSendReminder,
    canDeleteSharedAccess,
    deleteConfirmationKeyword,
    isDeleteKeywordMatched,
    showDocument,
    closeDetail,
    handleOpenDocument,
    handleSendReminder,
    handleDeleteSharedAccess,
    setDeleteConfirmationText,
    setShowDeleteConfirmation,
    detailModal,
  };
}
