'use client';

import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

// === Constants ================================================================

const DEFAULT_MAX_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

const DEFAULT_ACCEPTED_TYPES = [ // Most common types
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'text/html',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const DEFAULT_LABELS: Required<DragDropUploadLabels> = {
  idle: 'Drag and drop a file here, or click to browse',
  dragover: 'Drop your file here',
  selected: (fileName, fileSize) => `Selected: ${fileName} (${fileSize})`,
  uploading: 'Uploading…',
  errorType: 'File type not supported',
  errorSize: 'File exceeds maximum size of 150 MB',
  errorEmpty: 'File is empty',
  browse: 'Browse files',
};

type DropZoneState = 'idle' | 'dragover' | 'selected' | 'error' | 'uploading';

// === Types ====================================================================

export interface DragDropUploadLabels {
  idle?: string;
  dragover?: string;
  selected?: (fileName: string, fileSize: string) => string;
  uploading?: string;
  errorType?: string;
  errorSize?: string;
  errorEmpty?: string;
  browse?: string;
}

export interface DragDropUploadProps {
  /** Called when a valid file is accepted (via drag-drop or file picker). */
  onFileAccepted: (file: File) => void;
  /** Optional callback for validation errors. */
  onError?: (message: string) => void;
  /** Disables all interaction. */
  disabled?: boolean;
  /** Shows a loading spinner on the drop zone. */
  uploading?: boolean;
  /** Allowed MIME types. Falls back to DEFAULT_ACCEPTED_TYPES. */
  acceptedTypes?: string[];
  /** Maximum file size in bytes. Default: 150 MB. */
  maxSizeBytes?: number;
  /** Customizable text for i18n support. */
  labels?: DragDropUploadLabels;
  /** Children rendered inside the drop zone when idle. */
  children?: ReactNode;
}

// === Helpers ==================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${size} ${units[i]}`;
}

// === Component ================================================================

export function DragDropUpload({
  onFileAccepted,
  onError,
  disabled = false,
  uploading = false,
  acceptedTypes,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  labels: customLabels,
  children,
}: DragDropUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [zoneState, setZoneState] = useState<DropZoneState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<string>('');
  const dragCounter = useRef(0);

  // === Merged labels ========================================================

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels: Required<DragDropUploadLabels> = {
    ...DEFAULT_LABELS,
    ...customLabels,
  };

  // === File validation =======================================================

  const allowedTypes = acceptedTypes ?? DEFAULT_ACCEPTED_TYPES;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size === 0) {
        return labels.errorEmpty;
      }
      if (file.size > maxSizeBytes) {
        return labels.errorSize;
      }
      if (!allowedTypes.includes(file.type)) {
        return labels.errorType;
      }
      return null;
    },
    [allowedTypes, maxSizeBytes, labels],
  );

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setZoneState('error');
        setErrorMessage(error);
        onError?.(error);
        return;
      }

      setZoneState('selected');
      setSelectedFileName(file.name);
      setSelectedFileSize(formatFileSize(file.size));
      setErrorMessage('');
      onFileAccepted(file);
    },
    [onFileAccepted, onError, validateFile],
  );

  // === Drag event handlers ===================================================

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled || uploading) return;
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setZoneState('dragover');
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      // Only reset to idle if we're in dragover (not error or selected)
      setZoneState((prev) => (prev === 'dragover' ? 'idle' : prev));
    }
  }, []);

  // Track drag enter to handle nested element drag events correctly
  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current += 1;
      if (disabled || uploading) return;
      setZoneState('dragover');
    },
    [disabled, uploading],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;

      if (disabled || uploading) return;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      handleFile(files[0]);
    },
    [disabled, uploading, handleFile],
  );

  // === Click to browse =======================================================

  const handleZoneClick = useCallback(() => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }, [disabled, uploading]);

  const handleFileInputChange = useCallback(() => {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;
    handleFile(files[0]);
    // Reset input value so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFile]);

  // === Keyboard accessibility ================================================

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || uploading) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled, uploading],
  );

  // === Accepted MIME string for file input ===================================

  const acceptString = allowedTypes.join(',');

  // === Visual state helpers ==================================================

  const isInteractive = !disabled && !uploading;

  const getBorderColor = () => {
    switch (zoneState) {
      case 'dragover':
        return 'primary.main';
      case 'error':
        return 'error.main';
      default:
        return 'divider';
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return 'action.disabledBackground';
    if (uploading) return 'action.hover';
    if (zoneState === 'dragover') return 'action.hover';
    if (zoneState === 'selected') return 'success.light';
    if (zoneState === 'error') return 'error.light';
    return 'background.paper';
  };

  const getStatusText = (): string => {
    if (uploading) return labels.uploading;
    if (zoneState === 'dragover') return labels.dragover;
    if (zoneState === 'selected')
      return labels.selected(selectedFileName, selectedFileSize);
    if (zoneState === 'error') return errorMessage;
    return labels.idle;
  };

  return (
    <Box
      //  === Drop zone =======================================================
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-label={labels.idle}
      aria-disabled={disabled || uploading}
      aria-describedby={zoneState === 'error' ? `${inputId}-error` : undefined}
      data-state={uploading ? 'uploading' : zoneState}
      onClick={handleZoneClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        p: 4,
        border: 2,
        borderStyle: 'dashed',
        borderRadius: 2,
        borderColor: getBorderColor(),
        backgroundColor: getBackgroundColor(),
        cursor: isInteractive ? 'pointer' : 'not-allowed',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        textAlign: 'center',
        outline: 'none',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      {/* Hidden file input */}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptString}
        onChange={handleFileInputChange}
        disabled={disabled || uploading}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      {/* Content */}

      {uploading ? (
        <CircularProgress
          size={32}
          role="progressbar"
          aria-label={labels.uploading}
        />
      ) : (
        <>
          {zoneState === 'idle' && children}

          <Typography
            variant="body2"
            color={
              zoneState === 'error'
                ? 'error'
                : zoneState === 'selected'
                  ? 'success.dark'
                  : 'text.secondary'
            }
            sx={{ mt: 1 }}
          >
            {getStatusText()}
          </Typography>

          {zoneState === 'idle' && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {labels.browse}
            </Typography>
          )}
        </>
      )}

      {/* Error message for screen readers */}
      {zoneState === 'error' && (
        <Box
          id={`${inputId}-error`}
          role="alert"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {errorMessage}
        </Box>
      )}
    </Box>
  );
}
