import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@/app/theme/muiTheme';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { LegalSection } from '../LegalSection';

const theme = createAppTheme('dark');

/** Minimal legal i18n namespace for tests (T-007 not yet applied). */
const testMessages = {
  legal: {
    titles: {
      'legal-notice': 'Legal Notice',
      'privacy-policy': 'Privacy Policy',
      'cookie-policy': 'Cookie Policy',
      'terms-and-conditions': 'Terms and Conditions',
      'electronic-signature-policy': 'Electronic Signature Policy',
      'data-processing-agreement': 'Data Processing Agreement (DPA)',
      'document-retention-policy': 'Document Retention Policy',
    },
    page: {
      title: 'Legal Documents',
      not_found: 'Document not found',
    },
  },
};

function renderLegalSection(group: 'docs' | 'cookies') {
  return render(
    withIntlProvider(
      <ThemeProvider theme={theme}>
        <LegalSection group={group} />
      </ThemeProvider>,
      testMessages,
    ),
  );
}

describe('LegalSection', () => {
  describe('spec: renders document list by group', () => {
    it('renders exactly 6 documents when group is docs', () => {
      renderLegalSection('docs');

      const links = screen.getAllByRole('link');
      // docs group: slugs 1-6
      expect(links).toHaveLength(6);
    });

    it('renders exactly 1 document when group is cookies', () => {
      renderLegalSection('cookies');

      const links = screen.getAllByRole('link');
      // cookies group: slug 7
      expect(links).toHaveLength(1);
    });

    it('each document card links to the correct legal URL', () => {
      renderLegalSection('docs');

      const links = screen.getAllByRole('link');
      const hrefs = links.map((link) => link.getAttribute('href'));

      expect(hrefs).toContain('/legal/legal-notice');
      expect(hrefs).toContain('/legal/privacy-policy');
      expect(hrefs).toContain('/legal/cookie-policy');
      expect(hrefs).toContain('/legal/terms-and-conditions');
      expect(hrefs).toContain('/legal/electronic-signature-policy');
      expect(hrefs).toContain('/legal/data-processing-agreement');
      // Should NOT contain cookies-only slug
      expect(hrefs).not.toContain('/legal/document-retention-policy');
    });

    it('cookie group links to correct slugs', () => {
      renderLegalSection('cookies');

      const links = screen.getAllByRole('link');
      const hrefs = links.map((link) => link.getAttribute('href'));

      expect(hrefs).toContain('/legal/document-retention-policy');
    });
  });

  describe('spec: accessibility and keyboard navigation', () => {
    it('each document card has an accessible role', () => {
      renderLegalSection('docs');

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);

      // All links should be focusable (default for <a> elements)
      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('document cards use MUI Card components for visual structure', () => {
      renderLegalSection('docs');

      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards.length).toBe(6);
    });
  });
});
