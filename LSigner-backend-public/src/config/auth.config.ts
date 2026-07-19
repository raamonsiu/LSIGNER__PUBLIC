import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  /**
   * Secret used to sign and verify access tokens.
   * Required: JWT_SECRET env var must be set.
   */
  jwtSecret: process.env.JWT_SECRET,
  /**
   * Access token lifetime. Defaults to 15 minutes.
   * Accepted formats: '15m', '1h', '7d' (parsed by jsonwebtoken).
   */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  /**
   * Refresh token lifetime. Used as the TTL for opaque refresh tokens stored
   * hashed in the DB. Accepted formats: '15m', '1h', '7d'.
   */
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
