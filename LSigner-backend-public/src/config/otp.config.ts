import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
  length: parseInt(process.env.OTP_LENGTH ?? '6', 10),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
  lockMinutes: parseInt(process.env.OTP_LOCK_MINUTES ?? '15', 10),
  resendCooldownSeconds: parseInt(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60',
    10,
  ),
  maxResends: parseInt(process.env.OTP_MAX_RESENDS ?? '3', 10),
}));
