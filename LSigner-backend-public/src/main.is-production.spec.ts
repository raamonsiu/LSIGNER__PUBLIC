import { isProduction } from './config/is-production';

describe('isProduction', () => {
  describe('when APP_ENV is explicitly "production"', () => {
    it('returns true regardless of NODE_ENV', () => {
      expect(isProduction('production', 'development')).toBe(true);
      expect(isProduction('production', 'production')).toBe(true);
      expect(isProduction('production', 'staging')).toBe(true);
    });

    it('returns true even when NODE_ENV is undefined', () => {
      expect(isProduction('production', undefined)).toBe(true);
    });
  });

  describe('when APP_ENV is not "production"', () => {
    it('returns true if NODE_ENV is "production" (fallback for legacy deployments)', () => {
      expect(isProduction(undefined, 'production')).toBe(true);
      expect(isProduction('', 'production')).toBe(true);
    });

    it('returns false if neither APP_ENV nor NODE_ENV is "production"', () => {
      expect(isProduction('development', 'development')).toBe(false);
      expect(isProduction('staging', 'staging')).toBe(false);
      expect(isProduction(undefined, 'staging')).toBe(false);
    });

    it('returns false when both are undefined', () => {
      expect(isProduction(undefined, undefined)).toBe(false);
    });
  });
});
