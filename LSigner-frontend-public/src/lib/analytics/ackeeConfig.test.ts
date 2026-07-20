import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAckeeAnalyticsConfig } from './ackeeConfig';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HEX24 = '507f1f77bcf86cd799439011';

describe('parseAckeeAnalyticsConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enables analytics when server and UUID domain are valid', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'https://ackee.example.com/',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(config).toEqual({
      enabled: true,
      server: 'https://ackee.example.com',
      domainId: VALID_UUID,
      disableReason: null,
    });
  });

  it('accepts a 24-hex domain id format', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'https://ackee.example.com',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_HEX24,
      NODE_ENV: 'development',
    });

    expect(config.enabled).toBe(true);
    expect(config.domainId).toBe(VALID_HEX24);
  });

  it('disables analytics when required variables are missing', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: '',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: '',
      NODE_ENV: 'development',
    });

    expect(config).toEqual({
      enabled: false,
      server: null,
      domainId: null,
      disableReason: 'missing',
    });
  });

  it('disables analytics for malformed server URLs', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'not-a-url',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(config.enabled).toBe(false);
    expect(config.disableReason).toBe('invalid_server');
    expect(config.server).toBe(null);
    expect(config.domainId).toBe(null);
  });

  it('disables analytics for http servers in production', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'http://localhost:3000',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'production',
    });

    expect(config.enabled).toBe(false);
    expect(config.disableReason).toBe('invalid_server');
    expect(config.server).toBe(null);
    expect(config.domainId).toBe(null);
  });

  it('enables analytics for localhost http server in non-production', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'http://localhost:3000/',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(config).toEqual({
      enabled: true,
      server: 'http://localhost:3000',
      domainId: VALID_UUID,
      disableReason: null,
    });
  });

  it('disables analytics for non-localhost http servers in non-production', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'http://ackee.example.com',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(config.enabled).toBe(false);
    expect(config.disableReason).toBe('invalid_server');
    expect(config.server).toBe(null);
    expect(config.domainId).toBe(null);
  });

  it('disables analytics for malformed domain ids', () => {
    const config = parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'https://ackee.example.com',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: 'bad-domain-id',
      NODE_ENV: 'development',
    });

    expect(config.enabled).toBe(false);
    expect(config.disableReason).toBe('invalid_domain');
    expect(config.server).toBe(null);
    expect(config.domainId).toBe(null);
  });

  it('warns in non-production environments when disabled', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'not-a-url',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Ackee analytics disabled');
  });

  it('does not warn in production when disabled', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'not-a-url',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'production',
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when configuration is valid', () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    parseAckeeAnalyticsConfig({
      NEXT_PUBLIC_ACKEE_SERVER: 'https://ackee.example.com',
      NEXT_PUBLIC_ACKEE_DOMAIN_ID: VALID_UUID,
      NODE_ENV: 'development',
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
