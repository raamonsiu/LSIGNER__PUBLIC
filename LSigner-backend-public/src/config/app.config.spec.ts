import appConfig from './app.config';

describe('appConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('corsOrigins', () => {
    it('should default to http://localhost:3001 when CORS_ORIGINS is unset in development', () => {
      process.env.APP_ENV = 'development';
      delete process.env.CORS_ORIGINS;
      const config = appConfig();
      expect(config.corsOrigins).toEqual(['http://localhost:3001']);
    });

    it('should default to an empty list when CORS_ORIGINS is unset in production', () => {
      process.env.APP_ENV = 'production';
      delete process.env.CORS_ORIGINS;
      const config = appConfig();
      expect(config.corsOrigins).toEqual([]);
    });

    it('should parse comma-separated origins', () => {
      process.env.CORS_ORIGINS = 'http://a.com,https://b.com';
      const config = appConfig();
      expect(config.corsOrigins).toEqual(['http://a.com', 'https://b.com']);
    });

    it('should trim whitespace around origins', () => {
      process.env.CORS_ORIGINS = '  http://a.com  ,  https://b.com  ';
      const config = appConfig();
      expect(config.corsOrigins).toEqual(['http://a.com', 'https://b.com']);
    });

    it('should filter out empty segments from trailing commas', () => {
      process.env.CORS_ORIGINS = 'http://a.com,,,https://b.com,';
      const config = appConfig();
      expect(config.corsOrigins).toEqual(['http://a.com', 'https://b.com']);
    });

    it('should return a single origin when no comma is present', () => {
      process.env.CORS_ORIGINS = 'https://example.com';
      const config = appConfig();
      expect(config.corsOrigins).toEqual(['https://example.com']);
    });
  });

  describe('port', () => {
    it('should default to 3000 when APP_PORT is unset', () => {
      delete process.env.APP_PORT;
      const config = appConfig();
      expect(config.port).toBe(3000);
    });

    it('should parse APP_PORT as a number', () => {
      process.env.APP_PORT = '4000';
      const config = appConfig();
      expect(config.port).toBe(4000);
    });

    it('should fallback to 3000 for non-numeric APP_PORT', () => {
      process.env.APP_PORT = 'not-a-number';
      const config = appConfig();
      expect(config.port).toBe(3000);
    });
  });
});
