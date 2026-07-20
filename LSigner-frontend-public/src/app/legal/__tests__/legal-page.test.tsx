import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Hoisted mocks (vi.mock factories are hoisted, must not reference
//    module-level variables) ───────────────────────────────────────────────────

const { mockExistsSync, mockReadFileSync, mockNotFound, mockCookieGet } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockNotFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
    mockCookieGet: vi.fn(),
  }));

vi.mock('fs', () => ({
  __esModule: true,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync },
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: mockCookieGet,
  }),
}));

// ── Also mock react-markdown to verify it receives the right props ───────────
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => {
    // Simple markdown-to-HTML-like renderer for testing
    // Handles # heading, paragraphs, tables
    const lines = children.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i}>{line.slice(2)}</h1>);
        i++;
      } else if (line.startsWith('| ')) {
        // Collect table rows
        const rows: string[][] = [];
        while (i < lines.length && lines[i].startsWith('| ')) {
          const cells = lines[i]
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean);
          rows.push(cells);
          i++;
          // Skip separator row
          if (lines[i]?.startsWith('|-') || lines[i]?.startsWith('| -')) {
            i++;
          }
        }
        if (rows.length > 0) {
          elements.push(
            <table key={`t${i}`}>
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>,
          );
        }
      } else if (line.trim() === '') {
        i++;
      } else if (line.startsWith('*') && line.endsWith('*')) {
        elements.push(
          <p key={i}>
            <em>{line.slice(1, -1)}</em>
          </p>,
        );
        i++;
      } else {
        elements.push(<p key={i}>{line}</p>);
        i++;
      }
    }

    return <div className="markdown-body">{elements}</div>;
  },
}));

vi.mock('remark-gfm', () => ({
  default: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT — LegalPage. RED gate satisfied: file does not exist yet.
// ═══════════════════════════════════════════════════════════════════════════════
import LegalPage from '../[slug]/page';

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieGet.mockReturnValue({ value: 'en' });
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue('# Test Title\n\nTest paragraph content.');
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('LegalPage', () => {
  // ── 1. Happy path: valid slug renders markdown ─────────────────────────

  describe('spec: valid slug renders markdown', () => {
    it('renders markdown heading from the loaded file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '# Privacy Policy\n\nThis is the privacy policy content.',
      );

      const page = await LegalPage({
        params: Promise.resolve({ slug: 'privacy-policy' }),
      });
      render(page);

      // react-markdown transforms `# Privacy Policy` -> <h1>Privacy Policy</h1>
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      // `This is the privacy policy content.` -> <p>This is the privacy policy content.</p>
      expect(
        screen.getByText('This is the privacy policy content.'),
      ).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('reads the markdown file from the correct locale directory', async () => {
      mockCookieGet.mockReturnValue({ value: 'en' });

      await LegalPage({
        params: Promise.resolve({ slug: 'terms-and-conditions' }),
      });

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/content/legal/en/terms-and-conditions.md'),
      );
    });
  });

  // ── 2. Unknown slug -> notFound ────────────────────────────────────────

  describe('spec: unknown slug returns 404', () => {
    it('calls notFound when slug is not in the whitelist', async () => {
      await expect(
        LegalPage({
          params: Promise.resolve({ slug: 'nonexistent' }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalled();
    });

    it('calls notFound for empty slug', async () => {
      await expect(
        LegalPage({ params: Promise.resolve({ slug: '' }) }),
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  // ── 3. Locale fallback ────────────────────────────────────────────────

  describe('spec: locale fallback when translated file missing', () => {
    it('falls back to English when Catalan file is missing', async () => {
      mockCookieGet.mockReturnValue({ value: 'ca' });

      // CA file does not exist, EN file does
      mockExistsSync.mockImplementation((filePath: string) => {
        const pathStr = String(filePath);
        return pathStr.includes('/en/');
      });
      mockReadFileSync.mockReturnValue(
        '# Privacy Policy\n\nEnglish fallback content.',
      );

      const page = await LegalPage({
        params: Promise.resolve({ slug: 'privacy-policy' }),
      });
      render(page);

      expect(screen.getByText('English fallback content.')).toBeInTheDocument();
      // Should have checked CA first, then EN
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/ca/'),
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('/en/'),
      );
    });

    it('falls back to English when Spanish file is missing', async () => {
      mockCookieGet.mockReturnValue({ value: 'es' });

      mockExistsSync.mockImplementation((filePath: string) => {
        const pathStr = String(filePath);
        return pathStr.includes('/en/');
      });
      mockReadFileSync.mockReturnValue(
        '# Legal Notice\n\nEnglish notice content.',
      );

      const page = await LegalPage({
        params: Promise.resolve({ slug: 'legal-notice' }),
      });
      render(page);

      expect(screen.getByText('English notice content.')).toBeInTheDocument();
    });

    it('calls notFound when no locale has the file', async () => {
      mockCookieGet.mockReturnValue({ value: 'ca' });
      mockExistsSync.mockReturnValue(false);

      await expect(
        LegalPage({ params: Promise.resolve({ slug: 'privacy-policy' }) }),
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  // ── 4. Renders with GFM markdown features ──────────────────────────────

  describe('spec: GFM markdown support', () => {
    it('renders GFM tables via remark-gfm', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '# Data\n\n| Col A | Col B |\n|-------|-------|\n| a1 | b1 |',
      );

      const page = await LegalPage({
        params: Promise.resolve({ slug: 'data-processing-agreement' }),
      });
      render(page);

      // Table should render as HTML table elements
      expect(screen.getByText('Col A')).toBeInTheDocument();
      expect(screen.getByText('Col B')).toBeInTheDocument();
      expect(screen.getByText('a1')).toBeInTheDocument();
      expect(screen.getByText('b1')).toBeInTheDocument();
    });

    it('renders all 7 valid slugs without error', async () => {
      const slugs = [
        'legal-notice',
        'privacy-policy',
        'cookie-policy',
        'terms-and-conditions',
        'electronic-signature-policy',
        'data-processing-agreement',
        'document-retention-policy',
      ];

      for (const slug of slugs) {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(`# ${slug}\n\nContent.`);

        const page = await LegalPage({
          params: Promise.resolve({ slug }),
        });
        render(page);

        expect(screen.getByText(slug)).toBeInTheDocument();
      }
    });
  });
});
