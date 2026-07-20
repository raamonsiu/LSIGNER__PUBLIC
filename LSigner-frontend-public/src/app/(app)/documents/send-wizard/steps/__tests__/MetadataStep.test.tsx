import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MetadataStep } from '../MetadataStep';
import { withIntlProvider } from '@/lib/i18n/test-provider';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MetadataStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and description fields', () => {
    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle="contract"
          initialDescription=""
          onTitleChange={vi.fn()}
          onDescriptionChange={vi.fn()}
        />,
      ),
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('pre-fills title from initial prop', () => {
    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle="contract"
          initialDescription=""
          onTitleChange={vi.fn()}
          onDescriptionChange={vi.fn()}
        />,
      ),
    );

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveValue('contract');
  });

  it('pre-fills description from initial prop', () => {
    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle=""
          initialDescription="Some notes"
          onTitleChange={vi.fn()}
          onDescriptionChange={vi.fn()}
        />,
      ),
    );

    const descInput = screen.getByLabelText(/description/i);
    expect(descInput).toHaveValue('Some notes');
  });

  it('does NOT render a save button', () => {
    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle="contract"
          initialDescription=""
          onTitleChange={vi.fn()}
          onDescriptionChange={vi.fn()}
        />,
      ),
    );

    expect(
      screen.queryByRole('button', { name: /save/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onTitleChange when title input changes', () => {
    const onTitleChange = vi.fn();

    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle=""
          initialDescription=""
          onTitleChange={onTitleChange}
          onDescriptionChange={vi.fn()}
        />,
      ),
    );

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    expect(onTitleChange).toHaveBeenCalledWith('New Title');
  });

  it('calls onDescriptionChange when description input changes', () => {
    const onDescriptionChange = vi.fn();

    render(
      withIntlProvider(
        <MetadataStep
          documentId="doc-1"
          initialTitle=""
          initialDescription=""
          onTitleChange={vi.fn()}
          onDescriptionChange={onDescriptionChange}
        />,
      ),
    );

    const descInput = screen.getByLabelText(/description/i);
    fireEvent.change(descInput, { target: { value: 'New Description' } });

    expect(onDescriptionChange).toHaveBeenCalledWith('New Description');
  });
});
