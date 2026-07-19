import { registerAs } from '@nestjs/config';

/**
 * Application-level configuration namespace (`app.*`).
 * Values are read once at startup from environment variables;
 * defaults are used when the variable is absent.
 */
export default registerAs('app', () => {
  const rawPort = process.env.APP_PORT;
  const parsedPort = rawPort == null ? 3000 : parseInt(rawPort, 10);

  const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const isProd = env === 'production';

  // Comma-separated list of allowed CORS origins.
  // Example: CORS_ORIGINS=http://localhost:3001,https://lsigner.example.com
  // In production the default is empty (deny all cross-origin requests) to force
  // an explicit CORS_ORIGINS : failing safe when the variable is missing.
  const rawOrigins = process.env.CORS_ORIGINS;
  const corsOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : isProd
      ? []
      : ['http://localhost:3001'];

  return {
    name: process.env.APP_NAME ?? 'LSigner',
    env,
    port: Number.isFinite(parsedPort) ? parsedPort : 3000,
    corsOrigins,
    publicSessionTtlMinutes:
      Number(process.env.PUBLIC_SESSION_TTL_MINUTES ?? '60') || 60,
  };
});
