import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider, useAppTheme } from './ThemeContext';

function Probe() {
  const { mode, setTheme, toggleTheme } = useAppTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setTheme('light')}>set-light</button>
      <button onClick={() => setTheme('dark')}>set-dark</button>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

function renderWith(initialMode: 'dark' | 'light') {
  return render(
    <AppThemeProvider initialMode={initialMode}>
      <Probe />
    </AppThemeProvider>,
  );
}

describe('AppThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.cookie = 'theme=; path=/; max-age=0';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.cookie = 'theme=; path=/; max-age=0';
  });

  it('renders with the initialMode prop', () => {
    renderWith('dark');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it("respects initialMode='light'", () => {
    renderWith('light');
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('setTheme updates React state', () => {
    renderWith('dark');
    fireEvent.click(screen.getByRole('button', { name: 'set-light' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('setTheme mutates the data-theme attribute on <html>', () => {
    renderWith('dark');
    fireEvent.click(screen.getByRole('button', { name: 'set-light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme writes the cookie so the next SSR uses the new theme', () => {
    renderWith('dark');
    fireEvent.click(screen.getByRole('button', { name: 'set-light' }));
    expect(document.cookie).toMatch(/(?:^|;\s*)theme=light/);
  });

  it('toggleTheme switches between modes and persists', () => {
    renderWith('dark');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.cookie).toMatch(/(?:^|;\s*)theme=light/);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.cookie).toMatch(/(?:^|;\s*)theme=dark/);
  });

  it('useAppTheme throws when used outside the provider', () => {
    function Naked() {
      useAppTheme();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Naked />)).toThrow(
      /must be used within an AppThemeProvider/,
    );
    spy.mockRestore();
  });
});
