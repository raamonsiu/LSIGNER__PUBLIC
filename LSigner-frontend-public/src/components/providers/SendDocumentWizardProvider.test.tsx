import { describe, expect, it, vi } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import {
  SendDocumentWizardProvider,
  useWizard,
} from './SendDocumentWizardProvider';

// Mock SendDocumentWizard to avoid needing ThemeProvider/Intl in tests
vi.mock('@/app/(app)/documents/send-wizard/SendDocumentWizard', () => ({
  SendDocumentWizard: vi.fn(() => null),
}));

describe('SendDocumentWizardProvider', () => {
  it('throws when useWizard is used outside the provider', () => {
    expect(() => renderHook(() => useWizard())).toThrow(
      'useWizard must be used within SendDocumentWizardProvider',
    );
  });

  it('increments closeCount on each finishWizard call', () => {
    const { result } = renderHook(() => useWizard(), {
      wrapper: SendDocumentWizardProvider,
    });

    expect(result.current.closeCount).toBe(0);

    act(() => {
      result.current.finishWizard();
    });

    expect(result.current.closeCount).toBe(1);

    act(() => {
      result.current.finishWizard();
    });

    expect(result.current.closeCount).toBe(2);
  });

  it('does not increment closeCount on closeWizard (cancel)', () => {
    const { result } = renderHook(() => useWizard(), {
      wrapper: SendDocumentWizardProvider,
    });

    act(() => {
      result.current.closeWizard();
    });

    expect(result.current.closeCount).toBe(0);
  });

  it('provides openWizard, closeWizard, and finishWizard as stable callbacks', () => {
    const { result, rerender } = renderHook(() => useWizard(), {
      wrapper: SendDocumentWizardProvider,
    });

    const firstOpen = result.current.openWizard;
    const firstClose = result.current.closeWizard;
    const firstFinish = result.current.finishWizard;

    rerender();

    expect(result.current.openWizard).toBe(firstOpen);
    expect(result.current.closeWizard).toBe(firstClose);
    expect(result.current.finishWizard).toBe(firstFinish);
  });

  it('children render inside the provider', () => {
    render(
      <SendDocumentWizardProvider>
        <div data-testid="child">Hello</div>
      </SendDocumentWizardProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
