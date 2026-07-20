'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// === Props ====================================================================

export interface MetadataStepProps {
  documentId: string;
  initialTitle: string;
  initialDescription: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
}

// === Component ================================================================

export function MetadataStep({
  initialTitle,
  initialDescription,
  onTitleChange,
  onDescriptionChange,
}: MetadataStepProps) {
  const t = useTranslations('send_wizard');
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setTitle(newValue);
      onTitleChange(newValue);
    },
    [onTitleChange],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setDescription(newValue);
      onDescriptionChange(newValue);
    },
    [onDescriptionChange],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('metadata_title')}
      </Typography>

      <TextField
        label={t('metadata_title_label')}
        value={title}
        onChange={handleTitleChange}
        required
        fullWidth
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />

      <TextField
        label={t('metadata_description_label')}
        value={description}
        onChange={handleDescriptionChange}
        fullWidth
        multiline
        rows={3}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </Box>
  );
}
