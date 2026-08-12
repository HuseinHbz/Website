#!/usr/bin/env bash
# =============================================================================
# 26.34 бند۸ — shared secret-redaction filter.
#
# Sourced by upload-diagnostics.sh (and any future ops script that prints
# live server output — PM2 logs, nginx config dumps, …) so there is ONE
# place that defines "what a secret looks like", never duplicated per
# script. `redact` is a pipe filter: `some-command | redact`.
#
# Tested for real (not just read-and-trust) by
# deploy/lib/__tests__/redact.bats — see that file for the exact synthetic
# payloads this must strip.
# =============================================================================

redact() {
  sed -E \
    -e 's#([a-zA-Z][a-zA-Z0-9+.-]*://[^:/@[:space:]]+):[^@[:space:]]+@#\1:***@#g' \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/[REDACTED_JWT]/g' \
    -e 's/([Cc][Oo][Oo][Kk][Ii][Ee]:[[:space:]]*)[^[:space:]]+/\1[REDACTED]/g' \
    -e 's/([Aa][Uu][Tt][Hh][Oo][Rr][Ii][Zz][Aa][Tt][Ii][Oo][Nn]:[[:space:]]*)[^[:space:]]+/\1[REDACTED]/g' \
    -e 's/((admin_token|session_token|portal_token|hr_portal_token|api_key|apikey)[=:][[:space:]]*)[^;&[:space:]"'\'']+/\1[REDACTED]/gI' \
    -e 's/((PASSWORD|SECRET|_TOKEN|_KEY|DATABASE_URL|ADMIN_JWT_SECRET|BACKUP_ENCRYPTION_KEY)[[:space:]]*[:=][[:space:]]*)[^[:space:]"'\'']+/\1[REDACTED]/gI'
}
