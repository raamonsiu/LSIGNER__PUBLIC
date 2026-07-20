export type AckeeDisableReason =
  | 'missing'
  | 'invalid_server'
  | 'invalid_domain'
  | null;

export interface AckeeAnalyticsConfig {
  enabled: boolean;
  server: string | null;
  domainId: string | null;
  disableReason: AckeeDisableReason;
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX24_PATTERN = /^[0-9a-f]{24}$/i;

export function parseAckeeAnalyticsConfig(
  env: NodeJS.ProcessEnv,
): AckeeAnalyticsConfig {
  const serverCandidate = env['NEXT_PUBLIC_ACKEE_SERVER']?.trim();
  const domainCandidate = env['NEXT_PUBLIC_ACKEE_DOMAIN_ID']?.trim();

  if (!serverCandidate || !domainCandidate) {
    return disabledConfig('missing', env['NODE_ENV']);
  }

  const normalizedServer = normalizeServerUrl(serverCandidate, env['NODE_ENV']);
  if (!normalizedServer) {
    return disabledConfig('invalid_server', env['NODE_ENV']);
  }

  if (!isValidDomainId(domainCandidate)) {
    return disabledConfig('invalid_domain', env['NODE_ENV']);
  }

  return {
    enabled: true,
    server: normalizedServer,
    domainId: domainCandidate,
    disableReason: null,
  };
}

function normalizeServerUrl(
  raw: string,
  nodeEnv: string | undefined,
): string | null {
  try {
    const parsed = new URL(raw);
    const isHttps = parsed.protocol === 'https:';
    const isHttp = parsed.protocol === 'http:';

    if (!isHttps && !isHttp) {
      return null;
    }

    if (isHttp) {
      const isProduction = nodeEnv === 'production';
      const isLocalhost = parsed.hostname === 'localhost';
      if (isProduction || !isLocalhost) {
        return null;
      }
    }

    const normalized = parsed.toString().replace(/\/+$/, '');
    return normalized;
  } catch {
    return null;
  }
}

function isValidDomainId(raw: string): boolean {
  return UUID_V4_PATTERN.test(raw) || HEX24_PATTERN.test(raw);
}

function disabledConfig(
  reason: Exclude<AckeeDisableReason, null>,
  nodeEnv: string | undefined,
): AckeeAnalyticsConfig {
  if (nodeEnv !== 'production') {
    console.warn(`Ackee analytics disabled: ${reason}`);
  }

  return {
    enabled: false,
    server: null,
    domainId: null,
    disableReason: reason,
  };
}
