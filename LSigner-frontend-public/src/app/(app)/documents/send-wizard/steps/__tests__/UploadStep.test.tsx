import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UploadStep } from '../UploadStep';
import { uploadDocumentApi } from '@/lib/api/endpoints/documents';
import type { UploadDocumentResponse } from '@/lib/api/endpoints/types';
import { withIntlProvider } from '@/lib/i18n/test-provider';

vi.mock('@/lib/api/endpoints/documents', () => ({
  uploadDocumentApi: vi.fn(),
}));

// Mock DragDropUpload
vi.mock('@/components/upload/DragDropUpload', () => ({
  DragDropUpload: ({
    onFileAccepted,
    uploading,
  }: {
    onFileAccepted: (file: File) => void;
    uploading?: boolean;
  }) => (
    <div data-testid="dragdrop">
      <button
        data-testid="trigger-upload"
        onClick={() =>
          onFileAccepted(
            new File(['pdf content'], 'contract.pdf', {
              type: 'application/pdf',
            }),
          )
        }
      >
        Drop file
      </button>
      {uploading ? <span>uploading</span> : null}
    </div>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function triggerUpload() {
  const btn = screen.getByTestId('trigger-upload');
  await act(async () => {
    btn.click();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UploadStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DragDropUpload', () => {
    render(
      withIntlProvider(
        <UploadStep onDocumentUploaded={vi.fn()} onError={vi.fn()} />,
      ),
    );
    expect(screen.getByTestId('dragdrop')).toBeInTheDocument();
  });

  it('calls uploadDocumentApi when file is accepted', async () => {
    const mockResponse: UploadDocumentResponse = {
      id: 'doc-123',
      title: 'contract',
    };
    vi.mocked(uploadDocumentApi).mockResolvedValue(mockResponse);

    render(
      withIntlProvider(
        <UploadStep onDocumentUploaded={vi.fn()} onError={vi.fn()} />,
      ),
    );

    await triggerUpload();

    expect(uploadDocumentApi).toHaveBeenCalledWith(
      expect.any(File),
      'contract',
    );
  });

  it('calls onDocumentUploaded with documentId on success', async () => {
    const onDocumentUploaded = vi.fn();
    const mockResponse: UploadDocumentResponse = {
      id: 'doc-456',
      title: 'file',
    };
    vi.mocked(uploadDocumentApi).mockResolvedValue(mockResponse);

    render(
      withIntlProvider(
        <UploadStep
          onDocumentUploaded={onDocumentUploaded}
          onError={vi.fn()}
        />,
      ),
    );

    await triggerUpload();

    expect(onDocumentUploaded).toHaveBeenCalledWith(
      'doc-456',
      expect.any(File),
      'contract',
    );
  });

  it('calls onError when upload fails', async () => {
    const onError = vi.fn();
    vi.mocked(uploadDocumentApi).mockRejectedValue(new Error('Upload failed'));

    render(
      withIntlProvider(
        <UploadStep onDocumentUploaded={vi.fn()} onError={onError} />,
      ),
    );

    await triggerUpload();

    expect(onError).toHaveBeenCalledWith('Upload failed');
  });

  it('derives title from filename', async () => {
    const mockResponse: UploadDocumentResponse = {
      id: 'doc-789',
      title: 'my document',
    };
    vi.mocked(uploadDocumentApi).mockResolvedValue(mockResponse);

    render(
      withIntlProvider(
        <UploadStep onDocumentUploaded={vi.fn()} onError={vi.fn()} />,
      ),
    );

    await triggerUpload();

    expect(uploadDocumentApi).toHaveBeenCalledWith(
      expect.any(File),
      'contract',
    );
  });
});
