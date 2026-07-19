#!/bin/sh
# validate-env.sh — pre-start environment variable validation
# Only active when NODE_ENV=production. Validates 21 required vars.
# On failure: prints missing var names to STDERR and exits 1.
# On success: exits 0 silently.

[ "$NODE_ENV" != "production" ] && exit 0

REQUIRED_VARS="DOCUMENT_SIGNING_PRIVATE_KEY DOCUMENT_SIGNING_PUBLIC_KEY DB_USER DB_PASSWORD DB_NAME DB_HOST DB_PORT JWT_SECRET JWT_EXPIRES_IN JWT_REFRESH_EXPIRES_IN OTP_TTL_SECONDS OTP_LENGTH OTP_MAX_ATTEMPTS OTP_LOCK_MINUTES OTP_RESEND_COOLDOWN_SECONDS OTP_MAX_RESENDS EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASSWORD EMAIL_FROM"

missing=""

for var in $REQUIRED_VARS; do
    value=$(printenv "$var")
    [ -z "$value" ] && missing="$missing $var"
done

if [ -n "$missing" ]; then
    count=$(echo "$missing" | wc -w)
    echo "ERROR: Missing required environment variables ($count):" >&2
    for var in $missing; do
        echo "  - $var" >&2
    done
    exit 1
fi
