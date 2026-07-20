import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AckeeRouteChangeBridge } from './AckeeRouteChangeBridge';

let mockedPathname = '/';
let mockedSearch = '';

const recordSpy = vi.fn(() => ({ stop: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname,
  useSearchParams: () => new URLSearchParams(mockedSearch),
}));

describe('AckeeRouteChangeBridge', () => {
  beforeEach(() => {
    mockedPathname = '/';
    mockedSearch = '';
    recordSpy.mockClear();

    window.ackeeTracker = {
      record: recordSpy,
    };
  });

  it('does not emit pageviews when analytics is disabled, even across route transitions', async () => {
    const { rerender } = render(
      <AckeeRouteChangeBridge enabled={false} domainId="domain-1" />,
    );

    mockedPathname = '/login';
    rerender(<AckeeRouteChangeBridge enabled={false} domainId="domain-1" />);

    mockedPathname = '/dashboard';
    rerender(<AckeeRouteChangeBridge enabled={false} domainId="domain-1" />);

    mockedPathname = '/public/share-link-id';
    mockedSearch = 'preview=true';
    rerender(<AckeeRouteChangeBridge enabled={false} domainId="domain-1" />);

    await waitFor(() => {
      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  it('tracks auth, protected app, and public share route navigations under enabled config', async () => {
    const { rerender } = render(
      <AckeeRouteChangeBridge enabled={true} domainId="domain-1" />,
    );

    mockedPathname = '/login';
    mockedSearch = '';
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    mockedPathname = '/dashboard';
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    mockedPathname = '/public/9f7231ec-4f7f-4f56-9a3e-a4a7f6170b21';
    mockedSearch = 'source=email';
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(3);
      expect(recordSpy).toHaveBeenNthCalledWith(1, 'domain-1', {
        siteLocation: '/login',
      });
      expect(recordSpy).toHaveBeenNthCalledWith(2, 'domain-1', {
        siteLocation: '/dashboard',
      });
      expect(recordSpy).toHaveBeenNthCalledWith(3, 'domain-1', {
        siteLocation:
          '/public/9f7231ec-4f7f-4f56-9a3e-a4a7f6170b21?source=email',
      });
    });
  });

  it('emits one pageview when location changes after first render', async () => {
    const { rerender } = render(
      <AckeeRouteChangeBridge enabled={true} domainId="domain-1" />,
    );

    await waitFor(() => {
      expect(recordSpy).not.toHaveBeenCalled();
    });

    mockedPathname = '/dashboard';
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(1);
      expect(recordSpy).toHaveBeenCalledWith('domain-1', {
        siteLocation: '/dashboard',
      });
    });
  });

  it('suppresses duplicate pageviews for the same canonical location', async () => {
    const { rerender } = render(
      <AckeeRouteChangeBridge enabled={true} domainId="domain-1" />,
    );

    mockedPathname = '/reports';
    mockedSearch = 'filter=pending';
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(1);
      expect(recordSpy).toHaveBeenCalledWith('domain-1', {
        siteLocation: '/reports?filter=pending',
      });
    });

    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);
    rerender(<AckeeRouteChangeBridge enabled={true} domainId="domain-1" />);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(1);
    });
  });
});
