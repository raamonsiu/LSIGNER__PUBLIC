#!/bin/sh
# validate-env.test.sh : test suite for validate-env.sh
# Run: sh scripts/validate-env.test.sh
#
# Strict TDD: this file is written FIRST. The production script
# (validate-env.sh) does NOT exist yet : tests MUST fail (RED phase).

set -u

SCRIPT="scripts/validate-env.sh"
TMP_STDERR="/tmp/validate-env-test-stderr.$$"
PASS=0
FAIL=0

cleanup() { rm -f "$TMP_STDERR"; }
trap cleanup EXIT

# Helper: the 21 required variables 
REQUIRED_VARS="DOCUMENT_SIGNING_PRIVATE_KEY DOCUMENT_SIGNING_PUBLIC_KEY DB_USER DB_PASSWORD DB_NAME DB_HOST DB_PORT JWT_SECRET JWT_EXPIRES_IN JWT_REFRESH_EXPIRES_IN OTP_TTL_SECONDS OTP_LENGTH OTP_MAX_ATTEMPTS OTP_LOCK_MINUTES OTP_RESEND_COOLDOWN_SECONDS OTP_MAX_RESENDS EMAIL_HOST EMAIL_PORT EMAIL_USER EMAIL_PASSWORD EMAIL_FROM"

# Build an env string where every required var is set to the given value
build_all_env() {
    val="${1:-OK}"
    result=""
    for var in $REQUIRED_VARS; do
        result="$result $var=$val"
    done
    echo "${result# }"
}

# Build an env string where the named vars are OMITTED, others set to val
build_env_except() {
    val="${1:-OK}"
    shift
    omit="$*"
    result=""
    for var in $REQUIRED_VARS; do
        skip=0
        for o in $omit; do
            [ "$var" = "$o" ] && skip=1
        done
        [ $skip -eq 0 ] && result="$result $var=$val"
    done
    echo "${result# }"
}

# Run the script with the given env vars, capturing stderr
run_script() {
    env $1 sh "$SCRIPT" 2>"$TMP_STDERR"
}

# Assert exit code matches expected value
assert_exit() {
    label="$1" expected="$2" env_vars="$3"
    run_script "$env_vars" >/dev/null
    actual=$?
    if [ "$actual" -eq "$expected" ]; then
        echo "PASS: $label"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $label (expected exit $expected, got $actual)"
        [ -s "$TMP_STDERR" ] && { echo "  stderr:"; cat "$TMP_STDERR"; } >&2
        FAIL=$((FAIL + 1))
    fi
}

# Assert stderr contains expected text AND exit code is 1
assert_stderr_contains() {
    label="$1" expected_text="$2" env_vars="$3"
    run_script "$env_vars" >/dev/null
    actual=$?
    if [ "$actual" -ne 1 ]; then
        echo "FAIL: $label (expected exit 1, got $actual)"
        FAIL=$((FAIL + 1))
    elif grep -qF "$expected_text" "$TMP_STDERR"; then
        echo "PASS: $label"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $label — stderr missing '$expected_text'"
        echo "  stderr: $(cat "$TMP_STDERR")" >&2
        FAIL=$((FAIL + 1))
    fi
}

# Assert stderr does NOT contain unexpected text
assert_stderr_not_contains() {
    label="$1" unexpected_text="$2" env_vars="$3"
    run_script "$env_vars" >/dev/null
    if grep -qF "$unexpected_text" "$TMP_STDERR" 2>/dev/null; then
        echo "FAIL: $label — stderr MUST NOT contain '$unexpected_text'"
        echo "  stderr: $(cat "$TMP_STDERR")" >&2
        FAIL=$((FAIL + 1))
    else
        echo "PASS: $label"
        PASS=$((PASS + 1))
    fi
}

echo "=== validate-env.sh Test Suite ==="
echo ""

ALL_OK=$(build_all_env "OK")

# ========================================================== #
# REQ-ENV-001: Production guard — non-prod exits 0 silently
# ========================================================== #
assert_exit "1. NODE_ENV=development -> exit 0" 0 "NODE_ENV=development"
assert_exit "2. NODE_ENV unset -> exit 0" 0 "NODE_ENV="

# ========================================================== #
# REQ-ENV-005: Healthy production — all 21 vars -> exit 0
# ========================================================== #
assert_exit "3. All 21 vars + production -> exit 0" 0 "NODE_ENV=production $ALL_OK"

# ========================================================== #
# REQ-ENV-003 + REQ-ENV-004: Missing vars -> exit 1 + stderr
# ========================================================== #

# Single var missing
ENV_MISSING_ONE="NODE_ENV=production $(build_env_except "OK" DOCUMENT_SIGNING_PRIVATE_KEY)"
assert_stderr_contains "4. Missing 1 var -> name in stderr" \
    "DOCUMENT_SIGNING_PRIVATE_KEY" "$ENV_MISSING_ONE"

# Empty-string var treated as missing (DB_HOST="")
ENV_EMPTY="NODE_ENV=production $(build_all_env "OK")"
# Replace DB_HOST=OK with DB_HOST= (empty)
ENV_EMPTY=$(echo "$ENV_EMPTY" | sed 's/DB_HOST=OK/DB_HOST=/')
assert_stderr_contains "5. DB_HOST='' (empty) -> listed as missing" \
    "DB_HOST" "$ENV_EMPTY"

# Multiple vars missing (DB_HOST + JWT_SECRET)
ENV_MISSING_TWO="NODE_ENV=production $(build_env_except "OK" DB_HOST JWT_SECRET)"
assert_stderr_contains "6. Missing DB_HOST+JWT_SECRET -> DB_HOST listed" \
    "DB_HOST" "$ENV_MISSING_TWO"
assert_stderr_contains "7. Missing DB_HOST+JWT_SECRET -> JWT_SECRET listed" \
    "JWT_SECRET" "$ENV_MISSING_TWO"

# All 21 vars missing — only NODE_ENV=production
assert_stderr_contains "8. Zero vars -> first var listed" \
    "DOCUMENT_SIGNING_PRIVATE_KEY" "NODE_ENV=production"
assert_stderr_contains "9. Zero vars -> last var listed" \
    "EMAIL_FROM" "NODE_ENV=production"

# Error header with count
assert_stderr_contains "10. Zero vars -> header with count 21" \
    "Missing required environment variables (21)" "NODE_ENV=production"

# ========================================================== #
# Value leak protection
# Run with distinctive values, one var missing -> script fails
# Verify distinctive values are NEVER leaked in stderr
# ========================================================== #
ENV_NO_LEAK="NODE_ENV=production $(build_env_except "DO_NOT_LEAK_42" DOCUMENT_SIGNING_PRIVATE_KEY)"
assert_stderr_not_contains "11. Values not leaked in stderr" \
    "DO_NOT_LEAK_42" "$ENV_NO_LEAK"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

[ "$FAIL" -eq 0 ] || exit 1
