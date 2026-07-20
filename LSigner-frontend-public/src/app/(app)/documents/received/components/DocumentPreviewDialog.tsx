'use client';

// TOOD: Factor styles
import { useTranslations } from 'next-intl';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GavelIcon from '@mui/icons-material/Gavel';
import BlockIcon from '@mui/icons-material/Block';
import LockResetIcon from '@mui/icons-material/LockReset';
import { FilledButton } from '@/components/ui';
import type { DocumentActionType } from '@/lib/api/endpoints/types';

interface DocumentPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  documentName: string;
  senderName: string;
  fileSize: string;
  statusLabel: string;
  previewUrl: string;
  actionType: DocumentActionType | null;
  isSubmitting: boolean;
  onAction: (action: DocumentActionType) => void;
  onDownload: () => void;
}

const actionIcons: Record<DocumentActionType, typeof GavelIcon> = {
  SIGN: GavelIcon,
  REJECT: BlockIcon,
  REVOKE: LockResetIcon,
};

export default function DocumentPreviewDialog({
  open,
  onClose,
  documentName,
  senderName,
  fileSize,
  statusLabel,
  previewUrl,
  actionType,
  isSubmitting,
  onAction,
  onDownload,
}: DocumentPreviewDialogProps) {
  const t = useTranslations('received_documents.document_actions');
  const theme = useTheme();
  const ActionIcon = actionType ? actionIcons[actionType] : GavelIcon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      sx={{ '& .MuiDialog-paper': { height: '95vh' } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          py: 1.5,
          px: 2.5,
        }}
      >
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 700,
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {documentName}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 0 }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            bgcolor:
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 3,
            flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                display: 'block',
              }}
            >
              {t('sender')}
            </Typography>
            <Typography sx={{ fontSize: 13 }}>{senderName}</Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                display: 'block',
              }}
            >
              {t('size')}
            </Typography>
            <Typography sx={{ fontSize: 13 }}>{fileSize}</Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                display: 'block',
              }}
            >
              {t('status')}
            </Typography>
            <Typography sx={{ fontSize: 13 }}>{statusLabel}</Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor:
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : '#f5f5f5',
            mx: 2.5,
            mb: 1,
            borderRadius: 1,
            overflow: 'hidden',
            minHeight: 300,
          }}
        >
          {previewUrl ? (
            <object
              data={previewUrl}
              type="application/pdf"
              title={t('preview_title')}
              aria-label={t('preview_title')}
              style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
            >
              <Typography sx={{ color: 'text.secondary' }}>
                {t('preview_unavailable')}
              </Typography>
            </object>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>
              {t('preview_unavailable')}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t('back')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={onDownload}
          disabled={isSubmitting || !previewUrl}
        >
          {t('download')}
        </Button>
        {actionType && (
          <FilledButton
            onClick={() => onAction(actionType)}
            disabled={isSubmitting}
            startIcon={<ActionIcon />}
          >
            {isSubmitting ? t('processing') : t(actionType.toLowerCase())}
          </FilledButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
