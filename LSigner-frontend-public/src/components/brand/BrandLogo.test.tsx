/**
 * Tests for BrandLogo component.
 *
 * Verifies that BrandLogo renders the logo image, "LSigner" title,
 * and the translated subtitle from next-intl, with dark mode support.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { withIntlProvider } from '@/lib/i18n/test-provider';
import { BrandLogo } from './BrandLogo';

function renderWithProviders(
  ui: React.ReactElement,
  mode: 'light' | 'dark' = 'dark',
) {
  const theme = createTheme({ palette: { mode } });
  return render(
    <ThemeProvider theme={theme}>{withIntlProvider(ui)}</ThemeProvider>,
  );
}

describe('BrandLogo', () => {
  it('renders the LSigner logo image with priority', () => {
    renderWithProviders(<BrandLogo />);

    const img = screen.getByRole('img', { name: 'LSigner' });
    expect(img).toBeInTheDocument();
    // next/image transforms the src to an optimized URL; verify it contains the path
    expect(img.getAttribute('src')).toContain('logo-icon.png');
  });

  it('renders the LSigner title text', () => {
    renderWithProviders(<BrandLogo />);

    expect(screen.getByText('LSigner')).toBeInTheDocument();
  });

  it('renders the translated subtitle from common.brand.subtitle', () => {
    renderWithProviders(<BrandLogo />);

    expect(
      screen.getByText('Electronic Signature Provider'),
    ).toBeInTheDocument();
  });

  it('does NOT render the brand.tagline text', () => {
    renderWithProviders(<BrandLogo />);

    expect(screen.queryByText('Trusted workspace')).not.toBeInTheDocument();
  });

  it('applies dark mode invert filter on the logo image in dark mode', () => {
    renderWithProviders(<BrandLogo />, 'dark');

    const img = screen.getByRole('img', { name: 'LSigner' });
    // next/image applies the style prop as inline style
    expect(img).toHaveStyle({ filter: 'brightness(0) invert(1)' });
  });

  it('does NOT apply dark mode filter in light mode', () => {
    renderWithProviders(<BrandLogo />, 'light');

    const img = screen.getByRole('img', { name: 'LSigner' });
    expect(img.style.filter).toBe('');
  });
});
