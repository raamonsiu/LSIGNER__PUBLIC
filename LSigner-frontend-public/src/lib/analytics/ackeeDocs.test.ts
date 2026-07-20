import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENV_EXAMPLE_PATH = join(process.cwd(), '.env.example');
const README_PATH = join(process.cwd(), 'README.md');

function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

describe('Ackee documentation rollout', () => {
  describe('.env.example', () => {
    it('documents Ackee public variables with expected names', () => {
      const envExample = readFile(ENV_EXAMPLE_PATH);

      expect(envExample).toContain('NEXT_PUBLIC_ACKEE_SERVER=');
      expect(envExample).toContain('NEXT_PUBLIC_ACKEE_DOMAIN_ID=');
    });

    it('keeps Ackee placeholders non-empty for setup clarity', () => {
      const envExample = readFile(ENV_EXAMPLE_PATH);

      expect(envExample).toMatch(/NEXT_PUBLIC_ACKEE_SERVER=https?:\/\/.+/);
      expect(envExample).toMatch(
        /NEXT_PUBLIC_ACKEE_DOMAIN_ID=[0-9a-fA-F-]{24,36}/,
      );
    });
  });

  describe('README diagnostics and verification', () => {
    it('documents analytics enablement and disablement diagnostics', () => {
      const readme = readFile(README_PATH);

      expect(readme).toContain('## Ackee analytics (pageviews)');
      expect(readme).toContain('Ackee analytics disabled: missing');
      expect(readme).toContain('Ackee analytics disabled: invalid_server');
      expect(readme).toContain('Ackee analytics disabled: invalid_domain');
    });

    it('documents manual verification for initial load and route navigation', () => {
      const readme = readFile(README_PATH);

      expect(readme).toContain('Initial page load emits one pageview');
      expect(readme).toContain(
        'Client navigation emits one pageview per location change',
      );
      expect(readme).toContain('Auth route (`/login`)');
      expect(readme).toContain('Protected route (`/dashboard`)');
      expect(readme).toContain('Public route (`/public/{publicLinkId}`)');
    });
  });
});
