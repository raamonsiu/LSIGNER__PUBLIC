/**
 * Determines whether the application is running in production mode
 * based on environment variables.
 *
 * Uses `APP_ENV` as the primary indicator, falling back to `NODE_ENV`
 * when `APP_ENV` is not set or empty — matching the convention used
 * across the project (app.config.ts:12, app.module.ts:30, data-source.ts:16).
 *
 * @param appEnv  Value of `process.env.APP_ENV` (may be undefined or empty).
 * @param nodeEnv Value of `process.env.NODE_ENV` (may be undefined or empty).
 * @returns `true` when either APP_ENV or NODE_ENV is `'production'`.
 */
export function isProduction(appEnv?: string, nodeEnv?: string): boolean {
  return (appEnv || nodeEnv) === 'production';
}
