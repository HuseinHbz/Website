#!/usr/bin/env bash
# =============================================================================
# 26.34 бند۸ — real redaction proof for deploy/lib/redact.sh.
#
# Feeds synthetic (fake, non-real) secrets — a Postgres DSN, a JWT, a Cookie
# header, an Authorization header, and PASSWORD/SECRET/*_TOKEN/*_KEY-style
# env assignments — through the SAME `redact` function upload-diagnostics.sh
# actually pipes its PM2-log/nginx-config output through, and asserts the
# raw secret substring is ABSENT from the filtered output while the
# surrounding non-secret context (so the report stays useful) survives.
#
# Run: bash deploy/lib/__tests__/test-redact.sh
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../redact.sh"

n=0
failed=0

# assert_gone <secret> <full-line-to-redact> <label>
assert_gone() {
  local secret="$1" line="$2" label="$3"
  n=$((n+1))
  local out
  out="$(printf '%s\n' "$line" | redact)"
  if [[ "$out" != *"$secret"* ]]; then
    echo "  ✅ $n. $label"
  else
    failed=$((failed+1))
    echo "  ❌ $n. $label"
    echo "       input:  $line"
    echo "       output: $out"
  fi
}

# assert_kept <expected-substring> <full-line-to-redact> <label>
assert_kept() {
  local expected="$1" line="$2" label="$3"
  n=$((n+1))
  local out
  out="$(printf '%s\n' "$line" | redact)"
  if [[ "$out" == *"$expected"* ]]; then
    echo "  ✅ $n. $label"
  else
    failed=$((failed+1))
    echo "  ❌ $n. $label"
    echo "       input:  $line"
    echo "       output: $out"
  fi
}

echo "🧪 26.34 бند۸ — diagnostics-script secret redaction proof"
echo

# ---- 1. Postgres DSN credentials ----
DSN_SECRET="s3cr3t_db_pa55"
assert_gone "$DSN_SECRET" \
  "connecting to postgresql://hbzuser:${DSN_SECRET}@10.0.0.5:5432/habibazar_prod for migration check" \
  "Postgres DSN password is stripped"
assert_kept "hbzuser" \
  "connecting to postgresql://hbzuser:${DSN_SECRET}@10.0.0.5:5432/habibazar_prod for migration check" \
  "Postgres DSN username (non-secret, useful for diagnosis) survives"

# ---- 2. A JWT (admin session token shape) ----
FAKE_JWT="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4eXoiLCJyb2xlIjoic3VwZXJfYWRtaW4ifQ.abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI"
assert_gone "$FAKE_JWT" \
  "[AUDIT] LOGIN admin token=${FAKE_JWT} ip=127.0.0.1" \
  "a raw JWT is stripped"

# ---- 3. Cookie header ----
COOKIE_VAL="admin_token=eyJhbGciOiJIUzI1NiJ9.super.secretpayload; Path=/; HttpOnly"
assert_gone "eyJhbGciOiJIUzI1NiJ9.super.secretpayload" \
  "Cookie: ${COOKIE_VAL}" \
  "a Cookie header value is stripped"

# ---- 4. Authorization header ----
assert_gone "Bearer sk-live-FAKESECRETVALUE12345" \
  "Authorization: Bearer sk-live-FAKESECRETVALUE12345" \
  "an Authorization header value is stripped"

# ---- 5. admin_token= inline (not in a Cookie: line, e.g. logged from a URL) ----
assert_gone "9f8e7d6c5b4a" \
  "redirected with admin_token=9f8e7d6c5b4a3210 in query string" \
  "an inline admin_token= assignment is stripped"

# ---- 6. Generic *_PASSWORD / *_SECRET / *_TOKEN / *_KEY / DATABASE_URL env lines ----
assert_gone "hunter2CHANGE" \
  "ADMIN_SEED_PASSWORD=hunter2CHANGE" \
  "ADMIN_SEED_PASSWORD value is stripped"
assert_gone "abcdef0123456789" \
  "BACKUP_ENCRYPTION_KEY=abcdef0123456789" \
  "BACKUP_ENCRYPTION_KEY value is stripped"
assert_gone "topsecretjwtsigningkey" \
  "ADMIN_JWT_SECRET=topsecretjwtsigningkey" \
  "ADMIN_JWT_SECRET value is stripped"
assert_gone "1234567890abcdef" \
  "SMS_IR_API_KEY=1234567890abcdef" \
  "a *_KEY env value is stripped"
assert_gone "postgresql://x:y@z/db" \
  "DATABASE_URL=postgresql://x:y@z/db" \
  "DATABASE_URL value is stripped"

# ---- 7. Non-secret diagnostic content must survive untouched ----
assert_kept "client_max_body_size 30m" \
  "  client_max_body_size 30m;" \
  "a legitimate nginx directive (non-secret) is NOT redacted"
assert_kept "MEDIA_MAX_BACKGROUND_VIDEO_MB" \
  "MEDIA_MAX_BACKGROUND_VIDEO_MB=25" \
  "a non-secret MEDIA_MAX_* env var name/value is NOT redacted"
assert_kept "Commit abc1234" \
  "Commit abc1234 (fix: media upload path)" \
  "a commit hash / message (non-secret) is NOT redacted"

echo
if [[ $failed -eq 0 ]]; then
  echo "✅ $((n-failed))/$n assertions passed"
  exit 0
else
  echo "❌ $((n-failed))/$n assertions passed"
  exit 1
fi
