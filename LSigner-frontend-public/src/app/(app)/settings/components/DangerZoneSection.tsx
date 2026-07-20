'use client';

// Todo: Factor styles
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { deleteMyAccountApi } from '@/lib/api/endpoints/users';
import { DeleteAccountModal } from './DeleteAccountModal';

export function DangerZoneSection() {
  const t = useTranslations('settings.dangerZone');
  const theme = useTheme();
  const { logout } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = useCallback(() => {
    setError(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    if (!isLoading) {
      setIsModalOpen(false);
      setError(null);
    }
  }, [isLoading]);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await deleteMyAccountApi();
      showSnackbar(t('successSnackbar'), 'success');
      setIsModalOpen(false);
      logout();
    } catch {
      showSnackbar(t('errorSnackbar'), 'error');
      setError(t('errorSnackbar'));
    } finally {
      setIsLoading(false);
    }
  }, [logout, showSnackbar, t]);

  return (
    <Box
      id="danger-zone"
      sx={{
        scrollMarginTop: 80,
        py: 4,
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          fontSize: 22,
          color: theme.palette.chip.errorText,
          mb: 3,
        }}
      >
        {t('title')}
      </Typography>

      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha(theme.palette.chip.errorText, 0.3),
          bgcolor: alpha(theme.palette.chip.errorBg, 0.5),
          p: 4,
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 14,
            mb: 2,
          }}
        >
          {t('description')}
        </Typography>

        <Button
          variant="outlined"
          onClick={handleOpenModal}
          sx={{
            color: theme.palette.chip.errorText,
            borderColor: theme.palette.chip.errorText,
            '&:hover': {
              borderColor: theme.palette.chip.errorText,
              bgcolor: alpha(theme.palette.chip.errorText, 0.08),
            },
          }}
        >
          {t('deleteButton')}
        </Button>
      </Box>

      <DeleteAccountModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        error={error}
      />
    </Box>
  );
}
