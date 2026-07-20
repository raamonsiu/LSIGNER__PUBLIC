'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export interface AckeeRouteChangeBridgeProps {
  enabled: boolean;
  domainId: string;
}

export function AckeeRouteChangeBridge({
  enabled,
  domainId,
}: AckeeRouteChangeBridgeProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMountedRef = useRef(false);
  const lastTrackedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const canonicalLocation = buildCanonicalLocation(pathname, searchParams);
    if (!canonicalLocation) {
      return;
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastTrackedLocationRef.current = canonicalLocation;
      return;
    }

    if (lastTrackedLocationRef.current === canonicalLocation) {
      return;
    }

    window.ackeeTracker?.record(domainId, {
      siteLocation: canonicalLocation,
    });

    lastTrackedLocationRef.current = canonicalLocation;
  }, [enabled, domainId, pathname, searchParams]);

  return null;
}

function buildCanonicalLocation(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams> | URLSearchParams | null,
): string | null {
  if (!pathname) {
    return null;
  }

  const queryString = searchParams?.toString();
  if (!queryString) {
    return pathname;
  }

  return `${pathname}?${queryString}`;
}
