'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { DragDropUpload } from '@/components/upload/DragDropUpload';
import { uploadDocumentApi } from '@/lib/api/endpoints/documents';

// === Props ====================================================================

export interface UploadStepProps {
  onDocumentUploaded: (documentId: string, file: File, title: string) => void;
  onError: (message: string) => void;
}

// === Helpers ==================================================================

function deriveTitle(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

// === Component ================================================================

export function UploadStep({ onDocumentUploaded, onError }: UploadStepProps) {
  const t = useTranslations('upload');
  const wt = useTranslations('send_wizard');
  const [uploading, setUploading] = useState(false);

  const handleFileAccepted = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const title = deriveTitle(file.name);
        const response = await uploadDocumentApi(file, title);
        onDocumentUploaded(response.id, file, title);
      } catch (err) {
        const message = err instanceof Error ? err.message : wt('upload_fail');
        onError(message);
      } finally {
        setUploading(false);
      }
    },
    [onDocumentUploaded, onError, wt],
  );

  return (
    <DragDropUpload
      onFileAccepted={handleFileAccepted}
      onError={onError}
      uploading={uploading}
      labels={{
        idle: t('idle'),
        dragover: t('dragover'),
        selected: (fileName, fileSize) => t('selected', { fileName, fileSize }),
        uploading: t('uploading'),
        errorType: t('error_type'),
        errorSize: t('error_size'),
        errorEmpty: t('error_empty'),
        browse: t('browse'),
      }}
    />
  );
}
