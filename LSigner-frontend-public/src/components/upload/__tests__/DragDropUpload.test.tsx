import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DragDropUpload } from '../DragDropUpload';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a File-like object for testing with a controllable size. */
function createFile(name: string, size: number, type: string): File {
  // For small files, use real content. For oversized files, use a blob
  // with the reported size to avoid allocating huge arrays.
  if (size <= 1024 * 1024) {
    const content = new Uint8Array(size);
    return new File([content], name, { type });
  }
  // Create a blob whose reported size matches the requested size
  // without actually allocating that many bytes in the test process.
  const blob = new Blob([], { type });
  Object.defineProperty(blob, 'size', { value: size });
  return new File([blob], name, { type });
}

/** Builds a mock DataTransfer with the given files for drag events.
 *  jsdom may not expose the DataTransfer constructor — fall back to a mock. */
function createDataTransfer(files: File[]) {
  const dt: Record<string, unknown> = {
    files,
    items: files.map((f) => ({ kind: 'file', type: f.type })),
    types: ['Files'],
    getData: vi.fn(),
    setData: vi.fn(),
    clearData: vi.fn(),
    dropEffect: 'none',
  };
  return dt as unknown as DataTransfer;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PDF = createFile('test.pdf', 1000, 'application/pdf');
const VALID_PNG = createFile('test.png', 500, 'image/png');
const INVALID_EXE = createFile('virus.exe', 100, 'application/x-msdownload');
/** Use a file with real content that exceeds a custom maxSizeBytes. */
const SMALL_FILE = createFile('tiny.txt', 200, 'text/plain');
const EMPTY_FILE = createFile('empty.pdf', 0, 'application/pdf');

const DEFAULT_PROPS = {
  onFileAccepted: vi.fn(),
  onError: vi.fn(),
};

/** Helper to find the drop zone using the default accessible name. */
function getZone() {
  return screen.getByRole('button', { name: /drag and drop/i });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DragDropUpload', () => {
  it('renders the drop zone with accessible role and label', () => {
    render(<DragDropUpload {...DEFAULT_PROPS} />);

    const zone = getZone();
    expect(zone).toBeInTheDocument();
    expect(zone).toHaveAttribute('tabIndex', '0');
  });

  it('renders a hidden file input for click-to-browse', () => {
    const { container } = render(<DragDropUpload {...DEFAULT_PROPS} />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  describe('drag and drop', () => {
    it('adds visual highlight on dragover', () => {
      render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();

      fireEvent.dragOver(zone, {
        dataTransfer: createDataTransfer([VALID_PDF]),
      });

      // After dragover, the zone should indicate the active drag state
      expect(zone).toHaveAttribute('data-state', 'dragover');
    });

    it('removes highlight on dragLeave', () => {
      render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();

      fireEvent.dragOver(zone, {
        dataTransfer: createDataTransfer([VALID_PDF]),
      });
      fireEvent.dragLeave(zone);

      // After dragLeave, should return to idle state
      expect(zone).toHaveAttribute('data-state', 'idle');
    });

    it('fires onFileAccepted on drop with valid file', () => {
      const onFileAccepted = vi.fn();
      render(<DragDropUpload onFileAccepted={onFileAccepted} />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([VALID_PDF]),
      });

      expect(onFileAccepted).toHaveBeenCalledTimes(1);
      expect(onFileAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test.pdf' }),
      );
    });

    it('shows selected state with file name and size after valid drop', () => {
      render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([VALID_PDF]),
      });

      // The zone should switch to selected state
      expect(zone).toHaveAttribute('data-state', 'selected');
      // The label includes the file name and size
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });
  });

  describe('click to browse', () => {
    it('opens file picker when drop zone is clicked', () => {
      const { container } = render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();

      // Spy on the hidden input's click
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(zone);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('fires onFileAccepted when a file is selected via picker', () => {
      const onFileAccepted = vi.fn();
      const { container } = render(
        <DragDropUpload onFileAccepted={onFileAccepted} />,
      );
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(fileInput, {
        target: { files: [VALID_PNG] },
      });

      expect(onFileAccepted).toHaveBeenCalledTimes(1);
      expect(onFileAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test.png' }),
      );
    });
  });

  describe('validation', () => {
    it('shows error for unsupported file type', () => {
      const onError = vi.fn();
      render(<DragDropUpload onFileAccepted={vi.fn()} onError={onError} />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([INVALID_EXE]),
      });

      expect(zone).toHaveAttribute('data-state', 'error');
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('type'));
    });

    it('shows error for oversized file', () => {
      // Set max so small that a 200-byte file triggers the error
      render(
        <DragDropUpload
          onFileAccepted={vi.fn()}
          onError={vi.fn()}
          maxSizeBytes={100}
        />,
      );
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([SMALL_FILE]),
      });

      expect(zone).toHaveAttribute('data-state', 'error');
      expect(zone.textContent).toMatch(/size/i);
    });

    it('shows error for empty file', () => {
      render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([EMPTY_FILE]),
      });

      expect(zone).toHaveAttribute('data-state', 'error');
    });

    it('does NOT fire onFileAccepted for invalid files', () => {
      const onFileAccepted = vi.fn();
      render(<DragDropUpload onFileAccepted={onFileAccepted} />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([INVALID_EXE]),
      });

      expect(onFileAccepted).not.toHaveBeenCalled();
    });

    it('accepts custom acceptedTypes', () => {
      const onFileAccepted = vi.fn();
      render(
        <DragDropUpload
          onFileAccepted={onFileAccepted}
          acceptedTypes={['application/x-custom']}
        />,
      );
      const zone = getZone();

      const customFile = createFile('test.bin', 100, 'application/x-custom');
      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([customFile]),
      });

      expect(onFileAccepted).toHaveBeenCalledTimes(1);
    });

    it('accepts custom maxSizeBytes', () => {
      const onFileAccepted = vi.fn();
      // Set max large enough so SMALL_FILE (200 bytes) fits
      render(
        <DragDropUpload onFileAccepted={onFileAccepted} maxSizeBytes={1000} />,
      );
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([SMALL_FILE]),
      });

      expect(onFileAccepted).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled state', () => {
    it('prevents click interaction when disabled', () => {
      const { container } = render(
        <DragDropUpload {...DEFAULT_PROPS} disabled />,
      );
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');
      const zone = getZone();

      fireEvent.click(zone);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('prevents drag interaction when disabled', () => {
      const onFileAccepted = vi.fn();
      render(<DragDropUpload onFileAccepted={onFileAccepted} disabled />);
      const zone = getZone();

      fireEvent.drop(zone, {
        dataTransfer: createDataTransfer([VALID_PDF]),
      });

      expect(onFileAccepted).not.toHaveBeenCalled();
    });
  });

  describe('uploading state', () => {
    it('shows spinner when uploading', () => {
      render(<DragDropUpload {...DEFAULT_PROPS} uploading />);
      const zone = getZone();

      expect(zone).toHaveAttribute('data-state', 'uploading');
      // Should have a progress indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('opens file picker on Enter key', () => {
      const { container } = render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(zone, { key: 'Enter' });
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file picker on Space key', () => {
      const { container } = render(<DragDropUpload {...DEFAULT_PROPS} />);
      const zone = getZone();
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(zone, { key: ' ' });
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('labels customization', () => {
    it('uses custom labels when provided', () => {
      render(
        <DragDropUpload
          {...DEFAULT_PROPS}
          labels={{
            idle: 'Drop files here',
            browse: 'Select files',
          }}
        />,
      );

      expect(screen.getByText('Drop files here')).toBeInTheDocument();
      expect(screen.getByText('Select files')).toBeInTheDocument();
    });
  });
});
