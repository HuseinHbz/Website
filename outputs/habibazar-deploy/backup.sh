#!/usr/bin/env bash
# HBZ Platform Backup Script
# Usage: ./backup.sh [--dest /path/to/backups] [--db-only] [--retention-days 30]
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/var/www/habibazar}"
DATA_DIR="${DATA_DIR:-/var/data/habibazar}"
DB_PATH="${DB_PATH:-$DATA_DIR/habibazar.db}"
MEDIA_DIR="${MEDIA_DIR:-$DATA_DIR/uploads}"
BACKUP_DEST="${BACKUP_DEST:-/var/backups/habibazar}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_ONLY=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dest)          BACKUP_DEST="$2"; shift 2 ;;
    --db-only)       DB_ONLY=true;     shift ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$BACKUP_DEST"
BACKUP_DIR="$BACKUP_DEST/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*"; exit 1; }

# ── Database backup ───────────────────────────────────────────────────────────
log "Backing up database..."
if [[ -f "$DB_PATH" ]]; then
  # Use SQLite .backup for a consistent online backup
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/habibazar_$TIMESTAMP.db'" \
    || die "Database backup failed"
  gzip "$BACKUP_DIR/habibazar_$TIMESTAMP.db"
  log "Database backup: $BACKUP_DIR/habibazar_$TIMESTAMP.db.gz"
else
  log "WARN: Database file not found at $DB_PATH — skipping"
fi

# ── Media backup ──────────────────────────────────────────────────────────────
if [[ "$DB_ONLY" != "true" ]] && [[ -d "$MEDIA_DIR" ]]; then
  log "Backing up media uploads..."
  tar -czf "$BACKUP_DIR/media_$TIMESTAMP.tar.gz" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")" \
    || die "Media backup failed"
  log "Media backup: $BACKUP_DIR/media_$TIMESTAMP.tar.gz"
fi

# ── Config backup ─────────────────────────────────────────────────────────────
if [[ "$DB_ONLY" != "true" ]]; then
  log "Backing up configuration..."
  CONF_BACKUP="$BACKUP_DIR/config_$TIMESTAMP"
  mkdir -p "$CONF_BACKUP"
  [[ -f "$APP_DIR/.env.local" ]]       && cp "$APP_DIR/.env.local" "$CONF_BACKUP/" || true
  [[ -f "/etc/nginx/sites-available/habibazar" ]] && cp "/etc/nginx/sites-available/habibazar" "$CONF_BACKUP/" || true
  [[ -f "$(dirname "$0")/ecosystem.config.js" ]] && cp "$(dirname "$0")/ecosystem.config.js" "$CONF_BACKUP/" || true
  tar -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "config_$TIMESTAMP"
  rm -rf "$CONF_BACKUP"
  log "Config backup: $BACKUP_DIR/config_$TIMESTAMP.tar.gz"
fi

# ── Manifest ──────────────────────────────────────────────────────────────────
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
HBZ Platform Backup
Timestamp:  $TIMESTAMP
Created:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')
Host:       $(hostname)
DB Path:    $DB_PATH
Media Dir:  $MEDIA_DIR
EOF
ls -lh "$BACKUP_DIR" >> "$BACKUP_DIR/MANIFEST.txt"

# ── Retention cleanup ─────────────────────────────────────────────────────────
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DEST" -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} + || true

log "Backup complete: $BACKUP_DIR"
log "Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
