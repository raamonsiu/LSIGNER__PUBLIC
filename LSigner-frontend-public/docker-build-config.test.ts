/**
 * Tests for Docker build configuration ensuring legal content files are
 * included in the Docker build context and standalone output.
 *
 * These are config-assertion tests — they verify the build-time
 * configuration files contain the required patterns that prevent
 * legal document 404 errors in production Docker images.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(import.meta.dirname || __dirname);

describe('Docker build context for legal content', () => {
  // ── Task 1.1: .dockerignore allows legal .md files ────────────────────

  it('includes negation pattern to re-include legal content after blanket **/*.md exclusion', () => {
    const dockerignore = readFileSync(
      resolve(projectRoot, '.dockerignore'),
      'utf-8',
    );
    const lines = dockerignore.split('\n');

    // The negation must appear AFTER the **/*.md line to override it
    const mdLineIndex = lines.findIndex((line) => line.trim() === '**/*.md');
    expect(mdLineIndex).not.toBe(-1);

    const negationIndex = lines.findIndex(
      (line) => line.trim() === '!src/content/legal/**/*.md',
    );
    expect(negationIndex).not.toBe(-1);
    expect(negationIndex).toBeGreaterThan(mdLineIndex);
  });

  // ── Task 2.1: next.config.ts includes outputFileTracingIncludes ────────

  it('declares outputFileTracingIncludes for legal content in standalone output', () => {
    const config = readFileSync(
      resolve(projectRoot, 'next.config.ts'),
      'utf-8',
    );

    expect(config).toContain('outputFileTracingIncludes');
    expect(config).toContain("'/legal/**/*'");
    expect(config).toContain("'./src/content/legal/**/*'");
  });

  // ── Task 3.1: ci-dev.yml contains Docker smoke test for legal page ────

  it('includes a Docker smoke test step that verifies /legal/privacy-policy returns 200', () => {
    const workflow = readFileSync(
      resolve(projectRoot, '.github/workflows/ci-dev.yml'),
      'utf-8',
    );

    expect(workflow).toContain('smoke-test');
    expect(workflow).toContain('/legal/privacy-policy');
    expect(workflow).toContain('curl');
    expect(workflow).toContain('docker build');
  });
});
