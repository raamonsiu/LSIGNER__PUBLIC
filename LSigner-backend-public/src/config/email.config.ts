import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.EMAIL_HOST ?? '',
  port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
  user: process.env.EMAIL_USER ?? '',
  password: process.env.EMAIL_PASSWORD ?? '',
  from: process.env.EMAIL_FROM ?? 'info@lsigner.com',
  fromName: process.env.EMAIL_FROM_NAME ?? 'LSigner',
  secure: (process.env.EMAIL_SECURE ?? 'false') === 'true',
  debug: (process.env.EMAIL_DEBUG ?? 'false') === 'true',
  tlsRejectUnauthorized:
    (process.env.EMAIL_TLS_REJECT_UNAUTHORIZED ?? 'true') === 'true',
}));
