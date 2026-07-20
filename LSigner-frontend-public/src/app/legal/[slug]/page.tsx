import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

/** Whitelist of valid legal document slugs. Unknown slugs produce a 404. */
const VALID_SLUGS = [
  'legal-notice',
  'privacy-policy',
  'cookie-policy',
  'terms-and-conditions',
  'electronic-signature-policy',
  'data-processing-agreement',
  'document-retention-policy',
] as const;

/** Supported locales in priority order: requested locale first, then fallback. */
const LOCALES = ['en', 'es', 'ca'] as const;

type LegalSlug = (typeof VALID_SLUGS)[number];

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Resolves the best available locale for a given slug.
 * Tries the requested locale first, then falls back to other locales,
 * with English as the final fallback.
 *
 * Accepts an optional `baseDirOverride` for test injection — defaults
 * to `process.cwd()`.
 *
 * When the primary (cwd-based) path yields no match, falls back to a
 * path derived from `import.meta.url` for Docker standalone resilience.
 */
export function resolveContentPath(
  slug: LegalSlug,
  requestedLocale: string,
  baseDirOverride?: string,
): string | null {
  const cwdBase = baseDirOverride ?? process.cwd();
  const baseDir = join(cwdBase, 'src', 'content', 'legal');

  // == Diagnostic logging (non-production only) =========================
  if (process.env.APP_ENV !== 'production') {
    console.log('[legal-page] process.cwd():', process.cwd());
    console.log('[legal-page] cwdBase resolved to:', cwdBase);
    console.log('[legal-page] Primary baseDir:', baseDir);
  }

  // Try the requested locale first
  const requestedPath = join(baseDir, requestedLocale, `${slug}.md`);
  if (existsSync(requestedPath)) {
    return requestedPath;
  }

  // Try other supported locales (English is always last as ultimate fallback)
  for (const locale of LOCALES) {
    if (locale === requestedLocale) continue;
    const path = join(baseDir, locale, `${slug}.md`);
    if (existsSync(path)) {
      return path;
    }
  }

  // == import.meta.url fallback (Docker standalone rescue) ==============
  const fallbackRoot = deriveFallbackDir();
  if (fallbackRoot) {
    if (process.env.APP_ENV !== 'production') {
      console.log(
        '[legal-page] Fallback root (via import.meta.url):',
        fallbackRoot,
      );
    }
    const fallbackBase = join(fallbackRoot, 'src', 'content', 'legal');

    // Try requested locale with fallback base
    const fallbackRequestedPath = join(
      fallbackBase,
      requestedLocale,
      `${slug}.md`,
    );
    if (existsSync(fallbackRequestedPath)) {
      if (process.env.APP_ENV !== 'production') {
        console.log(
          '[legal-page] Resolved via fallback:',
          fallbackRequestedPath,
        );
      }
      return fallbackRequestedPath;
    }

    // Try other locales with fallback base
    for (const locale of LOCALES) {
      if (locale === requestedLocale) continue;
      const path = join(fallbackBase, locale, `${slug}.md`);
      if (existsSync(path)) {
        return path;
      }
    }
  }

  return null;
}

/**
 * Derives the project root directory from the current module's URL.
 * Walks up from `src/app/legal/[slug]/page.tsx` -> project root.
 * Returns null if `import.meta.url` is unavailable (e.g. non-ESM contexts).
 */
function deriveFallbackDir(): string | null {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    // [slug]/ -> legal/ -> app/ -> src/ -> project root
    let dir = dirname(modulePath); // [slug]/
    dir = dirname(dir); // legal/
    dir = dirname(dir); // app/
    dir = dirname(dir); // src/
    dir = dirname(dir); // project root
    return dir;
  } catch {
    return null;
  }
}

/**
 * Generates page metadata (title, description) for SEO.
 */
export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!VALID_SLUGS.includes(slug as LegalSlug)) {
    return { title: 'Not Found' };
  }

  // Read the first heading from the English file as the metadata title
  // (English is guaranteed to exist for all valid slugs)
  const cwdEnPath = join(
    process.cwd(),
    'src',
    'content',
    'legal',
    'en',
    `${slug}.md`,
  );
  let enPath: string | null = null;
  if (existsSync(cwdEnPath)) {
    enPath = cwdEnPath;
  } else {
    // Fall back to module-relative path (Docker standalone)
    const fallbackRoot = deriveFallbackDir();
    if (fallbackRoot) {
      const fallbackEnPath = join(
        fallbackRoot,
        'src',
        'content',
        'legal',
        'en',
        `${slug}.md`,
      );
      if (existsSync(fallbackEnPath)) {
        enPath = fallbackEnPath;
      }
    }
  }

  if (enPath) {
    const content = readFileSync(enPath, 'utf-8');
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return {
        title: `${headingMatch[1]} — LSigner`,
        description: `Legal document: ${headingMatch[1]}`,
      };
    }
  }

  return {
    title: 'Legal Document — LSigner',
    description: 'Legal document',
  };
}

/**
 * Server-component page that renders a legal markdown document.
 *
 * Resolves the user's locale via a cookie, loads the corresponding
 * `.md` file from `src/content/legal/{locale}/{slug}.md`, and renders
 * it as HTML via `react-markdown` with GFM support.
 *
 * Falls back to English (or any available locale) when the requested
 * translated file does not exist. Calls `notFound()` for unknown slugs
 * or when no markdown file exists in any locale.
 */
export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;

  if (!VALID_SLUGS.includes(slug as LegalSlug)) {
    notFound();
  }

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale');
  const requestedLocale = localeCookie?.value ?? 'en';

  const filePath = resolveContentPath(slug as LegalSlug, requestedLocale);

  if (!filePath) {
    notFound();
  }

  const content = readFileSync(filePath, 'utf-8');

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box
        className="legal-prose"
        sx={{
          '& h1': {
            fontSize: '2rem',
            fontWeight: 700,
            color: 'text.primary',
            mb: 3,
          },
          '& h2': {
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'text.primary',
            mt: 4,
            mb: 2,
          },
          '& h3': {
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'text.primary',
            mt: 3,
            mb: 1.5,
          },
          '& h4': {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'text.primary',
            mt: 2,
            mb: 1,
          },
          '& p': {
            fontSize: '1rem',
            color: 'text.secondary',
            lineHeight: 1.7,
            mb: 2,
          },
          '& ul, & ol': {
            pl: 3,
            mb: 2,
            color: 'text.secondary',
          },
          '& li': {
            mb: 0.5,
          },
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            mb: 2,
          },
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            px: 2,
            py: 1,
            textAlign: 'left',
          },
          '& th': {
            fontWeight: 600,
            backgroundColor: 'action.hover',
          },
          '& strong': {
            fontWeight: 700,
            color: 'text.primary',
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline',
          },
          '& blockquote': {
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            pl: 2,
            py: 0.5,
            my: 2,
            color: 'text.secondary',
            fontStyle: 'italic',
          },
          '& hr': {
            borderColor: 'divider',
            my: 3,
          },
          '& code': {
            backgroundColor: 'action.hover',
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: '0.875rem',
          },
          '& pre': {
            backgroundColor: 'action.hover',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
            mb: 2,
          },
          '& pre code': {
            backgroundColor: 'transparent',
            px: 0,
          },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Box>
    </Container>
  );
}
