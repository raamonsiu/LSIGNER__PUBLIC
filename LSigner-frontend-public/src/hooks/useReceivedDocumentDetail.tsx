'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import {
  fetchDocumentDownloadBlobUrl,
  getReceivedDocumentByIdApi,
} from '@/lib/api/endpoints/documents';
import { FilledButton } from '@/components/ui';
import type {
  DocumentActionType,
  ReceivedDocumentDetailResponse,
  ReceivedDocumentStatus,
} from '@/lib/api/endpoints/types';

interface UseReceivedDocumentDetailOptions {
  /** Translation function for received_documents namespace. */
  t: (key: string, params?: Record<string, string>) => string;
  /** Formats a file size in bytes to a human-readable string. */
  formatFileSize: (bytes: number) => string;
  /** Returns presentation info for a document status. */
  getStatusPresentation: (status: ReceivedDocumentStatus) => {
    label: string;
    color: string;
    bg: string;
  };
  /** Called when user clicks Sign, Reject, or Revoke on the detail modal. */
  onStartActionFlow: (action: DocumentActionType) => void;
  /** Optional custom open-document handler. Defaults to internal openDocument. */
  onOpenDocument?: () => void;
}

interface UseReceivedDocumentDetailReturn {
  selectedDocument: ReceivedDocumentDetailResponse | null;
  isDetailModalOpen: boolean;
  isModalDetailLoading: boolean;
  isOpenDocumentLoading: boolean;
  actionFlowDocId: string | null;
  pendingAction: DocumentActionType | null;
  showDocument: (documentId: string) => Promise<void>;
  closeDetail: () => void;
  openDocument: () => Promise<string>;
  startActionFlow: (action: DocumentActionType) => void;
  closeActionFlow: () => void;
  setSelectedDocument: (doc: ReceivedDocumentDetailResponse | null) => void;
  setIsDetailModalOpen: (open: boolean) => void;
  setActionFlowDocId: (id: string | null) => void;
  setPendingAction: (action: DocumentActionType | null) => void;
  /** Rendered detail modal JSX, or null when options are not provided or modal is closed. */
  detailModal: React.JSX.Element | null;
}

function revokeBlobUrl(blobUrl: string | null): void {
  if (typeof window === 'undefined') return;
  if (!blobUrl || !blobUrl.startsWith('blob:')) return;
  URL.revokeObjectURL(blobUrl);
}

/**
 * Fetches a document binary blob and returns a blob: URL.
 * Delegates the raw fetch to the shared {@link fetchDocumentDownloadBlobUrl}.
 *
 * @throws Error('DOWNLOAD_FAILED_401') on 401.
 * @throws Error('DOWNLOAD_FAILED') on network errors.
 */
export async function fetchDownloadBlobUrl(
  documentId: string,
): Promise<string> {
  if (typeof window === 'undefined') throw new Error('MISSING_WINDOW');
  const binaryBlob = await fetchDocumentDownloadBlobUrl(documentId);
  return URL.createObjectURL(binaryBlob);
}

/** Maximum PDF size allowed for in-iframe data URL preview (50 MB). */
export const PDF_PREVIEW_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

/**
 * Fetches a document PDF blob and returns a base64 data URL for sandboxed
 * iframe rendering. Falls back to `window.open(blobUrl)` when the blob
 * exceeds {@link PDF_PREVIEW_SIZE_LIMIT} (50 MB).
 *
 * @throws Error('PDF_TOO_LARGE_FOR_PREVIEW') when blob exceeds 50 MB.
 * @throws Error('FILE_READER_ERROR') when FileReader conversion fails.
 */
export async function fetchDownloadDataUrl(
  documentId: string,
): Promise<string> {
  const binaryBlob = await fetchDocumentDownloadBlobUrl(documentId);

  if (binaryBlob.size > PDF_PREVIEW_SIZE_LIMIT) {
    const blobUrl = URL.createObjectURL(binaryBlob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    throw new Error('PDF_TOO_LARGE_FOR_PREVIEW');
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FILE_READER_ERROR'));
    reader.readAsDataURL(binaryBlob);
  });
}

/**
 * Hook that manages received document detail loading, download, and action flow state.
 *
 * When `options` are provided, the hook also returns a `detailModal` JSX element
 * that renders the detail dialog internally : pages just render `{detailModal}`.
 */
export function useReceivedDocumentDetail(
  options?: UseReceivedDocumentDetailOptions,
): UseReceivedDocumentDetailReturn {
  const detailCacheRef = useRef<Map<string, ReceivedDocumentDetailResponse>>(
    new Map(),
  );

  const [selectedDocument, setSelectedDocument] =
    useState<ReceivedDocumentDetailResponse | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isModalDetailLoading, setIsModalDetailLoading] = useState(false);
  const [isOpenDocumentLoading, setIsOpenDocumentLoading] = useState(false);
  const [actionFlowDocId, setActionFlowDocId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DocumentActionType | null>(
    null,
  );

  const showDocument = useCallback(async (documentId: string) => {
    setIsDetailModalOpen(true);

    const cached = detailCacheRef.current.get(documentId);
    if (cached) {
      setSelectedDocument(cached);
      return;
    }

    setIsModalDetailLoading(true);
    setSelectedDocument(null);
    try {
      const detail = await getReceivedDocumentByIdApi(documentId);
      detailCacheRef.current.set(documentId, detail);
      setSelectedDocument(detail);
    } catch {
      setIsDetailModalOpen(false);
    } finally {
      setIsModalDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedDocument(null);
    setIsModalDetailLoading(false);
  }, []);

  const openDocument = useCallback(async (): Promise<string> => {
    if (!selectedDocument) throw new Error('No document selected');
    setIsOpenDocumentLoading(true);
    try {
      const blobUrl = await fetchDownloadBlobUrl(selectedDocument.id);
      const openedWindow = window.open(blobUrl, '_blank');
      if (!openedWindow) {
        revokeBlobUrl(blobUrl);
        throw new Error('POPUP_BLOCKED');
      }
      openedWindow.opener = null;
      setTimeout(() => revokeBlobUrl(blobUrl), 60_000);
      return blobUrl;
    } finally {
      setIsOpenDocumentLoading(false);
    }
  }, [selectedDocument]);

  const startActionFlow = useCallback(
    (action: DocumentActionType) => {
      if (!selectedDocument) return;
      setActionFlowDocId(selectedDocument.id);
      setPendingAction(action);
    },
    [selectedDocument],
  );

  const closeActionFlow = useCallback(() => {
    setActionFlowDocId(null);
    setPendingAction(null);
  }, []);

  // == Detail modal JSX (only when options are provided) =====================

  const detailModal = useMemo<React.JSX.Element | null>(() => {
    if (!options || !isDetailModalOpen) return null;

    const {
      t,
      formatFileSize,
      getStatusPresentation,
      onStartActionFlow,
      onOpenDocument,
    } = options;
    const handleOpenClick =
      onOpenDocument ??
      (() => {
        void openDocument();
      });

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
            onClick={handleOpenClick}
            disabled={
              isModalDetailLoading || !selectedDocument || isOpenDocumentLoading
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
          {isModalDetailLoading || !selectedDocument ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>
                  {selectedDocument.document_name}
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
                    onClick={handleOpenClick}
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
                    {selectedDocument.original_filename}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    · {formatFileSize(selectedDocument.file_size_bytes)}
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
                    {t('fields.sender')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <PersonOutlinedIcon
                        sx={{ fontSize: 14, color: 'text.secondary' }}
                      />
                      {selectedDocument.sender.name ??
                        selectedDocument.sender.email}
                    </Box>
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('fields.received_at')}
                  </Typography>
                  <Typography sx={{ fontSize: 13 }}>
                    {new Date(
                      selectedDocument.received_at,
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
                    {selectedDocument.signed_at
                      ? new Date(
                          selectedDocument.signed_at,
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
                    {
                      getStatusPresentation(
                        selectedDocument.my_recipient.signing_status,
                      ).label
                    }
                  </Typography>
                </Box>
              </Box>

              {selectedDocument.sender.deleted && (
                <Alert
                  severity="error"
                  variant="outlined"
                  sx={{ fontSize: 13 }}
                >
                  {t('modal.sender_deleted')}
                </Alert>
              )}

              {selectedDocument.expires_at && (
                <Alert
                  severity={selectedDocument.signed_at ? 'success' : 'info'}
                  variant="outlined"
                  sx={{ fontSize: 13 }}
                >
                  {selectedDocument.signed_at
                    ? t('messages.signed_before_expiry')
                    : `${t('messages.expires_on')} ${new Date(selectedDocument.expires_at).toLocaleDateString()}`}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={closeDetail}>{t('modal.close')}</Button>
          </Box>
          {selectedDocument &&
            !isModalDetailLoading &&
            (() => {
              const s = selectedDocument.my_recipient.signing_status;
              const senderDeleted = selectedDocument.sender.deleted;
              if (s === 'PENDING') {
                return (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      color="primary"
                      variant="contained"
                      disabled={senderDeleted}
                      onClick={() => onStartActionFlow('REJECT')}
                    >
                      {t('document_actions.reject')}
                    </Button>
                    <FilledButton
                      disabled={senderDeleted}
                      onClick={() => onStartActionFlow('SIGN')}
                    >
                      {t('document_actions.sign')}
                    </FilledButton>
                  </Box>
                );
              }
              if (s === 'SIGNED') {
                return (
                  <FilledButton
                    disabled={senderDeleted}
                    onClick={() => onStartActionFlow('REVOKE')}
                  >
                    {t('document_actions.revoke')}
                  </FilledButton>
                );
              }
              return null;
            })()}
        </DialogActions>
      </Dialog>
    );
  }, [
    options,
    isDetailModalOpen,
    isModalDetailLoading,
    selectedDocument,
    isOpenDocumentLoading,
    closeDetail,
    openDocument,
  ]);

  return {
    selectedDocument,
    isDetailModalOpen,
    isModalDetailLoading,
    isOpenDocumentLoading,
    actionFlowDocId,
    pendingAction,
    showDocument,
    closeDetail,
    openDocument,
    startActionFlow,
    closeActionFlow,
    setSelectedDocument,
    setIsDetailModalOpen,
    setActionFlowDocId,
    setPendingAction,
    detailModal,
  };
}
