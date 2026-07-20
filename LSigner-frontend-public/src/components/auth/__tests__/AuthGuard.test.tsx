import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '@/components/auth/AuthGuard';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = vi.fn();

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthGuard', () => {
  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isSessionRestored: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret dashboard</div>
      </AuthGuard>,
    );

    expect(screen.getByTestId('protected-content')).toHaveTextContent(
      'Secret dashboard',
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isSessionRestored: true,
    });

    render(
      <AuthGuard>
        <div>Should not render</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders nothing while session restoration is in flight', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isSessionRestored: false,
    });

    const { container } = render(
      <AuthGuard>
        <div>Should not render</div>
      </AuthGuard>,
    );

    expect(container.textContent).toBe('');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
