import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GhostButton } from '@/components/ui';

describe('GhostButton', () => {
  it('renders children with text variant', () => {
    render(<GhostButton>View all</GhostButton>);
    const btn = screen.getByRole('button', { name: /view all/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('MuiButton-text');
  });
});
