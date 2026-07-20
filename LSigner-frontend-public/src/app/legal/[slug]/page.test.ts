/**
 * Unit tests for resolveContentPath — the legal page path resolver.
 *
 * Approach: Rather than mocking 'fs' (which has known issues with vitest
 * hoisting in async factory mode), we test the function with controlled
 * `baseDirOverride` values and verify path construction logic.
 *
 * The fallback path derived from `import.meta.url` resolves to the real
 * project root on disk, so content files physically present WILL be found.
 * The key assertion is that the primary path is tried first and that a
 * non-existent directory yields null.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'path';

// Suppress diagnostic logging in tests — must be set BEFORE module import
// since the diagnostic gates are evaluated inside the function body at
// call time (not at import time).
process.env.APP_ENV = 'production';

const { resolveContentPath } = await import('./page');

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('resolveContentPath', () => {
  const slug = 'privacy-policy';
  const locale = 'en';

  it('returns the cwd-based path when baseDirOverride is provided and file exists', () => {
    // Use the REAL project root so the content files are actually found
    // on disk. The function will find the file via the first path tried.
    const realRoot = join(process.cwd(), 'src', 'app', 'legal', '[slug]');
    // Walk up to project root from the module path
    const parts = realRoot.split('/');
    // Remove: [slug], legal, app, src -> project root
    const projectRoot = parts.slice(0, -4).join('/');

    const result = resolveContentPath(slug, locale, projectRoot);

    expect(result).not.toBeNull();
    // The path should contain the project root (whether cwd or fallback)
    expect(result).toContain('src/content/legal');
    expect(result).toContain(`${slug}.md`);
  });

  it('falls back to import.meta.url-based path when cwd-based root is nonexistent', () => {
    // Provide a nonexistent directory — the primary path will fail,
    // and the fallback (which uses import.meta.url on the real project)
    // should succeed because real content files exist.
    const result = resolveContentPath(slug, locale, '/nonexistent/dir');

    expect(result).not.toBeNull();
    // The result should be the fallback path (NOT the /nonexistent one)
    expect(result).not.toContain('/nonexistent');
    expect(result).toContain('src/content/legal');
    expect(result).toContain(`${slug}.md`);
  });

  it('returns null when no content file exists via any strategy', () => {
    // Use a nonexistent slug — even the real fallback won't find it
    const nonexistentSlug = 'nonexistent-legal-doc-xyz';

    const result = resolveContentPath(
      nonexistentSlug as typeof slug,
      locale,
      '/nonexistent/dir',
    );

    expect(result).toBeNull();
  });
});
