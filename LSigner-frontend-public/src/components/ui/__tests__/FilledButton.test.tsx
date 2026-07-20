import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilledButton } from '@/components/ui';

describe('FilledButton', () => {
  it('renders children and applies MUI contained variant', () => {
    render(<FilledButton>Click me</FilledButton>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('MuiButton-contained');
  });

  it('forwards additional props like disabled', () => {
    render(<FilledButton disabled>Disabled</FilledButton>);
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled();
  });
});
