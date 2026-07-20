import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecondaryButton } from '@/components/ui';

describe('SecondaryButton', () => {
  it('renders children with contained secondary variant', () => {
    render(<SecondaryButton>New Document</SecondaryButton>);
    const btn = screen.getByRole('button', { name: /new document/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('MuiButton-colorSecondary');
  });
});
