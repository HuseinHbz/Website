#!/usr/bin/env bash
# =============================================================================
# HBZ Website — بکاپ خودکار سازمانی (encrypted, checksummed, verified)
# =============================================================================
# Usage:
#   sudo -u hbz bash deploy/backup.sh [bucket]
#     bucket: hourly | daily | weekly | monthly | yearly   (default: daily)
#
#   hourly  → database only        (retention 48h)
#   daily   → full (db+media+cfg)  (retention 30d)
#   weekly  → full                 (retention 84d / 12w)
#   monthly → full                 (retention 730d / 24m)
#   yearly  → full                 (retention 3650d / 10y)
#
# Each backup is: consistent SQLite snapshot (+integrity check) → tar.gz →
# AES-256 encrypted (openssl, pbkdf2) → sha256 checksummed → verified →
# old backups in the bucket pruned by age → status written for monitoring.
#
# Optional offsite copy (3-2-1 rule): set BACKUP_REMOTE to an rclone remote
# (e.g. "myremote:habibazar") or an rsync target (e.g. "user@host:/backups");
# the encrypted file + checksum are uploaded.
#
# Encryption key: /home/hbz/.backup-key (created by install.sh, chmod 600).
# =============================================================================
set -uo pipefail

APP_USER="${APP_USER:-hbz}"
APP_DIR="${APP_DIR:-/var/www/habibazar}"
WEB_DIR="$APP_DIR"
DB_PATH="${DB_PATH:-$WEB_DIR/data/habibazar.db}"
UPLOADS_DIR="$WEB_DIR/public/uploads"
ENV_FILE="$WEB_DIR/.env.local"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/habibazar}"
KEY_FILE="${BACKUP_KEY_FILE:-/home/$APP_USER/.backup-key}"
LOG_FILE="${BACKUP_LOG_FILE:-/home/$APP_USER/logs/backup.log}"
NGINX_CONF="/etc/nginx/sites-available/habibazar"
BUCKET="${1:-daily}"

# Retention (in minutes, for `find -mmin`) per bucket
declare -A RETENTION_MIN=(
  [hourly]=2880       # 48h
  [daily]=43200       # 30d
  [weekly]=120960     # 84d  (12 weeks)
  [monthly]=1051200   # 730d (24 months)
  [yearly]=5256000    # 3650d (10 years)
)

OUT_FILE=""; OUT_SIZE=0; OUT_SHA=""
log() { echo "$(date '+%Y-%m-%dT%H:%M:%S%z') [backup] $1" | tee -a "$LOG_FILE" >&2; }

write_status() {
  mkdir -p "$BACKUP_ROOT"
  cat > "$BACKUP_ROOT/last-status.json" <<JSON
{"bucket":"$BUCKET","status":"$1","detail":"${2:-}","file":"${OUT_FILE##*/}","size":${OUT_SIZE:-0},"sha256":"${OUT_SHA:-}","finishedAt":"$(date '+%Y-%m-%dT%H:%M:%S%z')"}
JSON
}
die() { log "ERROR: $1"; write_status "failed" "$1"; exit 1; }

[[ -n "${RETENTION_MIN[$BUCKET]:-}" ]] || die "unknown bucket: $BUCKET (hourly|daily|weekly|monthly|yearly)"
mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_ROOT/$BUCKET"
[[ -f "$DB_PATH" ]] || die "database not found: $DB_PATH"
command -v sqlite3 >/dev/null || die "sqlite3 not installed"
command -v openssl >/dev/null || die "openssl not installed"
[[ -f "$KEY_FILE" ]] || die "encryption key not found: $KEY_FILE (run install.sh)"

STAMP="$(date '+%Y%m%d-%H%M%S')"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

log "starting $BUCKET backup"

# ── 1. Database — consistent snapshot + integrity check ──────────────────────
sqlite3 "$DB_PATH" ".backup '$STAGING/database.sqlite'" || die "sqlite .backup failed"
INTEG="$(sqlite3 "$STAGING/database.sqlite" 'PRAGMA integrity_check;' 2>&1)"
[[ "$INTEG" == "ok" ]] || die "integrity_check failed: $INTEG"
log "database snapshot ok (integrity: ok)"

# ── 2. Full backups also capture media + config ──────────────────────────────
CONTENTS="database.sqlite"
if [[ "$BUCKET" != "hourly" ]]; then
  [[ -d "$UPLOADS_DIR" ]] && cp -a "$UPLOADS_DIR" "$STAGING/uploads" 2>/dev/null && CONTENTS="$CONTENTS uploads"
  mkdir -p "$STAGING/config"; CONTENTS="$CONTENTS config"
  [[ -f "$ENV_FILE" ]]   && cp "$ENV_FILE"   "$STAGING/config/env.local"  2>/dev/null || true
  [[ -f "$NGINX_CONF" ]] && cp "$NGINX_CONF" "$STAGING/config/nginx.conf" 2>/dev/null || true
  [[ -f "$APP_DIR/deploy/pm2.config.js" ]] && cp "$APP_DIR/deploy/pm2.config.js" "$STAGING/config/" 2>/dev/null || true
  cp "$WEB_DIR/package.json" "$WEB_DIR/package-lock.json" "$STAGING/config/" 2>/dev/null || true
  ( cd "$APP_DIR" && git rev-parse HEAD 2>/dev/null > "$STAGING/config/git-commit.txt" ) 2>/dev/null || true
  log "captured media + config"
fi

# ── 3. Archive → encrypt (AES-256) → checksum ────────────────────────────────
ARCHIVE="$STAGING/backup.tar.gz"
# shellcheck disable=SC2086
tar -czf "$ARCHIVE" -C "$STAGING" $CONTENTS 2>/dev/null || die "tar failed"

OUT_FILE="$BACKUP_ROOT/$BUCKET/${STAMP}-${BUCKET}.tar.gz.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
  -in "$ARCHIVE" -out "$OUT_FILE" -pass "file:$KEY_FILE" || die "encryption failed"
OUT_SHA="$(sha256sum "$OUT_FILE" | awk '{print $1}')"
echo "$OUT_SHA" > "$OUT_FILE.sha256"
OUT_SIZE="$(stat -c%s "$OUT_FILE")"
log "encrypted → $(basename "$OUT_FILE") ($((OUT_SIZE/1024)) KB)"

# ── 4. Verify: checksum + decrypt-and-read (recoverability) ───────────────────
[[ "$(sha256sum "$OUT_FILE" | awk '{print $1}')" == "$OUT_SHA" ]] || die "checksum mismatch after write"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in "$OUT_FILE" -pass "file:$KEY_FILE" 2>/dev/null \
  | tar -tzf - >/dev/null 2>&1 || die "verification failed — backup not readable"
log "verified: checksum ok, archive decrypts & lists ok"

# ── 5. Retention — purge expired backups in this bucket ──────────────────────
PURGED="$(find "$BACKUP_ROOT/$BUCKET" -type f -mmin "+${RETENTION_MIN[$BUCKET]}" -name '*.enc*' -print -delete 2>/dev/null | grep -c . || true)"
[[ "${PURGED:-0}" -gt 0 ]] && log "retention: purged $PURGED expired file(s)"

# ── 6. Offsite copy (3-2-1) — optional ───────────────────────────────────────
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  if [[ "$BACKUP_REMOTE" != *@* ]] && command -v rclone >/dev/null; then
    rclone copy "$OUT_FILE" "$BACKUP_REMOTE/$BUCKET/" 2>/dev/null \
      && rclone copy "$OUT_FILE.sha256" "$BACKUP_REMOTE/$BUCKET/" 2>/dev/null \
      && log "offsite: uploaded via rclone → $BACKUP_REMOTE/$BUCKET/" || log "WARN: rclone upload failed"
  elif command -v rsync >/dev/null; then
    rsync -a "$OUT_FILE" "$OUT_FILE.sha256" "$BACKUP_REMOTE/" 2>/dev/null \
      && log "offsite: uploaded via rsync → $BACKUP_REMOTE" || log "WARN: rsync upload failed"
  else
    log "WARN: BACKUP_REMOTE set but neither rclone nor rsync available"
  fi
fi

write_status "ok" "integrity ok; verified"
log "DONE: $BUCKET backup complete"
echo "$OUT_FILE"
