import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutlineButton } from '@/components/ui';

describe('OutlineButton', () => {
  it('renders children with outlined variant', () => {
    render(<OutlineButton>Cancel</OutlineButton>);
    const btn = screen.getByRole('button', { name: /cancel/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('MuiButton-outlined');
  });
});
