import { registerAs } from '@nestjs/config';

/**
 * Database configuration namespace (`database.*`).
 * Reads PostgreSQL connection parameters and optional SSL settings from
 * environment variables. `synchronize` is guarded to be `true` only in
 * non-production environments when explicitly opted-in via TYPEORM_SYNC.
 */
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'lsb_dev_local',
  ssl: (() => {
    const sslEnabled = (process.env.DB_SSL ?? 'false') === 'true';
    if (!sslEnabled) return false;
    const rejectUnauthorized =
      (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true') === 'true';
    return { rejectUnauthorized };
  })(),
  synchronize:
    (process.env.APP_ENV ?? 'development') !== 'production' &&
    (process.env.TYPEORM_SYNC ?? 'false') === 'true',
  logging: (process.env.DB_LOGGING ?? 'false') === 'true',
}));
