import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  act,
  waitFor,
} from '@testing-library/react';
import { SnackbarProvider } from '@/components/providers/SnackbarProvider';
import { SendDocumentWizard } from '../SendDocumentWizard';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// Mock API calls used by the wizard
vi.mock('@/lib/api/endpoints/documents', () => ({
  uploadDocumentApi: vi.fn(),
  updateDocumentApi: vi.fn(),
  sendDocumentApi: vi.fn(),
}));
vi.mock('@/lib/api/endpoints/contacts', () => ({
  createContactApi: vi.fn(),
}));

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function renderWizard(
  props: { open?: boolean; onClose?: () => void; onSent?: () => void } = {},
) {
  return render(
    withIntlProvider(
      <SnackbarProvider>
        <SendDocumentWizard
          open={props.open ?? true}
          onClose={props.onClose ?? vi.fn()}
          onSent={props.onSent ?? vi.fn()}
        />
      </SnackbarProvider>,
    ),
  );
}

// Mock all step components
vi.mock('../steps/UploadStep', () => ({
  UploadStep: ({
    onDocumentUploaded,
  }: {
    onDocumentUploaded: (id: string, file: File, title: string) => void;
    onError: (msg: string) => void;
  }) => (
    <div data-testid="upload-step">
      <button
        data-testid="simulate-upload"
        onClick={() =>
          onDocumentUploaded(
            'doc-123',
            new File([], 'contract.pdf'),
            'contract',
          )
        }
      >
        Upload
      </button>
    </div>
  ),
}));

vi.mock('../steps/MetadataStep', () => ({
  MetadataStep: ({
    initialTitle,
    onTitleChange,
    onDescriptionChange,
  }: {
    documentId: string;
    initialTitle: string;
    initialDescription: string;
    onTitleChange: (title: string) => void;
    onDescriptionChange: (description: string) => void;
  }) => (
    <div data-testid="metadata-step">
      <span data-testid="meta-title">{initialTitle}</span>
      <button
        data-testid="change-title"
        onClick={() => onTitleChange('New Title')}
      >
        Change Title
      </button>
      <button
        data-testid="change-description"
        onClick={() => onDescriptionChange('New Desc')}
      >
        Change Description
      </button>
    </div>
  ),
}));

vi.mock('../steps/RecipientsStep', () => ({
  RecipientsStep: ({
    onRecipientsChange,
  }: {
    onRecipientsChange: (r: unknown[]) => void;
    onError: (msg: string) => void;
  }) => (
    <div data-testid="recipients-step">
      <button
        data-testid="add-recipient"
        onClick={() =>
          onRecipientsChange([
            {
              email: 'alice@example.com',
              name: 'Alice',
              saveAsContact: false,
            },
          ])
        }
      >
        Add Recipient
      </button>
    </div>
  ),
}));

vi.mock('../steps/ConfirmStep', () => ({
  ConfirmStep: ({
    title,
    recipients,
  }: {
    title: string;
    description: string;
    recipients: unknown[];
  }) => (
    <div data-testid="confirm-step">
      <span data-testid="confirm-title">{title}</span>
      <span data-testid="confirm-recipients">{recipients.length}</span>
    </div>
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SendDocumentWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts at step 1 (Upload)', () => {
    renderWizard();
    expect(screen.getByTestId('upload-step')).toBeInTheDocument();
  });

  it('advances to step 2 after upload', async () => {
    renderWizard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    expect(screen.getByTestId('metadata-step')).toBeInTheDocument();
  });

  it('shows progress with step indicator', () => {
    renderWizard();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
  });

  it('no back button on step 1', () => {
    renderWizard();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('goes back to previous step', async () => {
    renderWizard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    const backBtn = screen.getByRole('button', { name: /back/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });
    expect(screen.getByTestId('upload-step')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWizard({ onClose });

    const closeBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('patching metadata on Next from step 2: success advances to step 3', async () => {
    const { updateDocumentApi } = await import('@/lib/api/endpoints/documents');
    vi.mocked(updateDocumentApi).mockResolvedValue(undefined);

    renderWizard();
    // Step 1: Upload
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    // Change title so handler has values
    await act(async () => {
      fireEvent.click(screen.getByTestId('change-title'));
    });
    // Step 2: Click Next
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateDocumentApi).toHaveBeenCalledWith('doc-123', {
      title: 'New Title',
      description: '',
    });
    // Should advance to step 3
    expect(screen.getByTestId('recipients-step')).toBeInTheDocument();
  });

  it('patching metadata on Next from step 2: failure shows error and stays on step 2', async () => {
    const { updateDocumentApi } = await import('@/lib/api/endpoints/documents');
    vi.mocked(updateDocumentApi).mockRejectedValue(new Error('Network error'));

    renderWizard();
    // Step 1: Upload
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    // Step 2: Click Next (no changes, just click)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Should still be on step 2 (metadata-step visible)
    expect(screen.getByTestId('metadata-step')).toBeInTheDocument();
    // Should NOT be on step 3
    expect(screen.queryByTestId('recipients-step')).toBeNull();
    // Error snackbar should show
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('on step 4, DialogActions shows Send button (not Next)', async () => {
    const { updateDocumentApi, sendDocumentApi } =
      await import('@/lib/api/endpoints/documents');
    vi.mocked(updateDocumentApi).mockResolvedValue(undefined);
    vi.mocked(sendDocumentApi).mockResolvedValue({
      document_id: 'doc-123',
      status: 'SENT',
      recipients: [],
    });

    renderWizard();
    // Step 1: Upload
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    // Step 2: Next (metadata save)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Step 3: Add recipient + Next
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-recipient'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    // Step 4: Send button should be visible, Next should not
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it('on step 4, Back button is still present', async () => {
    const { updateDocumentApi, sendDocumentApi } =
      await import('@/lib/api/endpoints/documents');
    vi.mocked(updateDocumentApi).mockResolvedValue(undefined);
    vi.mocked(sendDocumentApi).mockResolvedValue({
      document_id: 'doc-123',
      status: 'SENT',
      recipients: [],
    });

    renderWizard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-recipient'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    // Back should be visible on step 4
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('completes full flow', async () => {
    const onSent = vi.fn();
    const { updateDocumentApi, sendDocumentApi } =
      await import('@/lib/api/endpoints/documents');
    vi.mocked(updateDocumentApi).mockResolvedValue(undefined);
    vi.mocked(sendDocumentApi).mockResolvedValue({
      document_id: 'doc-123',
      status: 'SENT',
      recipients: [],
    });

    renderWizard({ onSent });

    // Step 1: Upload
    await act(async () => {
      fireEvent.click(screen.getByTestId('simulate-upload'));
    });
    // Step 2: Next (metadata save via wizard)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Step 3: Recipients
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-recipient'));
    });
    // Next to step 4
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    // Step 4: Send (from DialogActions, not ConfirmStep)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSent).toHaveBeenCalled();
  });
});
