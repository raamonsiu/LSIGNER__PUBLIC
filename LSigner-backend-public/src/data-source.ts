import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

/**
 * Standalone TypeORM DataSource used by the CLI for migration commands
 * (`migration:generate`, `migration:run`, `migration:revert`).
 * Uses the same env-var defaults applied in database.config.ts.
 * `synchronize` is always `false` to prevent accidental schema changes.
 *
 * Env file loading policy (same as app.module.ts / ConfigModule ignoreEnvFile):
 * In non-production: .env.local -> .env.<env> -> .env  (highest -> lowest precedence)
 * In production:     no env files are loaded — all vars must come from the process
 *                    environment (e.g. Docker/K8s secrets, CI secrets injection).
 */
const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';
const envFile = `.env.${env}`;
if (!isProd) {
  // In production all variables must be injected by the runtime environment;
  // env files are intentionally ignored to match app.module.ts behavior.
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: envFile });
  dotenv.config();
}

export default new DataSource({
  type: 'postgres',
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
  entities: [isProd ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],
  migrations: [isProd ? 'dist/src/migrations/*.js' : 'src/migrations/*.ts'],
  synchronize: false,
  logging: (process.env.DB_LOGGING ?? 'false') === 'true',
});
