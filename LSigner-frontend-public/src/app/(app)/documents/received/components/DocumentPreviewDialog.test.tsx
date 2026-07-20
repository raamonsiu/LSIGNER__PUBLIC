import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import DocumentPreviewDialog from './DocumentPreviewDialog';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  documentName: 'test-doc.pdf',
  senderName: 'John Doe',
  fileSize: '2.5 MB',
  statusLabel: 'Pending',
  previewUrl: 'https://example.com/preview',
  actionType: 'SIGN' as const,
  isSubmitting: false,
  onAction: vi.fn(),
  onDownload: vi.fn(),
};

function renderDialog(props = {}) {
  return render(
    withIntlProvider(<DocumentPreviewDialog {...defaultProps} {...props} />),
  );
}

describe('DocumentPreviewDialog', () => {
  it('renders document name as title', () => {
    renderDialog({ documentName: 'contract.pdf' });
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
  });

  it('renders sender info from translations', () => {
    renderDialog({ senderName: 'Alice' });
    expect(screen.getByText('Sender')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders size from translations', () => {
    renderDialog({ fileSize: '1.2 MB' });
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('1.2 MB')).toBeInTheDocument();
  });

  it('renders status from translations', () => {
    renderDialog({ statusLabel: 'Signed' });
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('renders preview unavailable text when no previewUrl', () => {
    renderDialog({ previewUrl: '' });
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
  });

  it('renders back button from translations', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('renders download button from translations', () => {
    renderDialog();
    expect(
      screen.getByRole('button', { name: 'Download' }),
    ).toBeInTheDocument();
  });

  it('renders action button with translated action label', () => {
    renderDialog({ actionType: 'SIGN' });
    expect(screen.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
  });

  it('renders processing text from translations when submitting', () => {
    renderDialog({ isSubmitting: true, actionType: 'SIGN' });
    expect(
      screen.getByRole('button', { name: /Processing/ }),
    ).toBeInTheDocument();
  });

  it('calls onAction when action button clicked', () => {
    const onAction = vi.fn();
    renderDialog({ actionType: 'REJECT', onAction });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onAction).toHaveBeenCalledWith('REJECT');
  });

  it('calls onDownload when download button clicked', () => {
    const onDownload = vi.fn();
    renderDialog({ onDownload });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalled();
  });

  it('calls onClose when back button clicked', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders object tag with PDF data URL for cross-browser preview', () => {
    renderDialog({ previewUrl: 'data:application/pdf;base64,test123' });

    const objectEl = screen.getByTitle('Document preview') as HTMLObjectElement;
    expect(objectEl).toBeInTheDocument();
    expect(objectEl.tagName).toBe('OBJECT');
    expect(objectEl.getAttribute('type')).toBe('application/pdf');
    expect(objectEl.getAttribute('data')).toBe(
      'data:application/pdf;base64,test123',
    );
  });

  it('renders object tag with fallback content for preview errors', () => {
    renderDialog({ previewUrl: 'data:application/pdf;base64,test123' });

    const objectEl = screen.getByTitle('Document preview');
    expect(objectEl).toBeInTheDocument();

    // <object> fallback content renders as children when PDF plugin is unavailable
    // JSDOM has no PDF plugin, so fallback content is always in the DOM
    const fallback = screen.getByText('Preview unavailable');
    expect(fallback).toBeInTheDocument();
  });
});
