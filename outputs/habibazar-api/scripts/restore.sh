#!/bin/bash
set -euo pipefail

# Restore script for habibazar database from R2 backup
# Usage: ./restore.sh [backup-filename]
# If no filename given, lists available backups and prompts for selection

# Required env vars: DATABASE_URL, R2_BUCKET, R2_ENDPOINT
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY must also be set

BACKUP_FILENAME="${1:-}"
TMPFILE="/tmp/restore_$(date +%Y%m%d_%H%M%S).sql.gz"

if [ -z "$BACKUP_FILENAME" ]; then
  echo "Available backups:"
  echo "===================="
  aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url="${R2_ENDPOINT}" | grep "habibazar_backup_" | sort -r
  echo ""
  read -r -p "Enter backup filename to restore: " BACKUP_FILENAME
fi

if [ -z "$BACKUP_FILENAME" ]; then
  echo "ERROR: No backup filename provided"
  exit 1
fi

echo "[$(date -Iseconds)] Starting restore from: ${BACKUP_FILENAME}"

# Confirm before proceeding
echo ""
echo "WARNING: This will OVERWRITE the current database!"
echo "Target: ${DATABASE_URL}"
echo "Source: s3://${R2_BUCKET}/${BACKUP_FILENAME}"
echo ""
read -r -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled"
  exit 1
fi

# Download backup
echo "[$(date -Iseconds)] Downloading backup..."
aws s3 cp "s3://${R2_BUCKET}/${BACKUP_FILENAME}" "$TMPFILE" --endpoint-url="${R2_ENDPOINT}"

# Verify download
gzip -t "$TMPFILE"
echo "[$(date -Iseconds)] Download verified: $(du -h "$TMPFILE" | cut -f1)"

# Extract database name from URL for drop/recreate
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\///')

# Option 1: Restore into existing database (safer for production)
echo "[$(date -Iseconds)] Restoring database..."
gunzip -c "$TMPFILE" | psql "$DATABASE_URL"

# Clean up
rm "$TMPFILE"

echo "[$(date -Iseconds)] Restore complete from: ${BACKUP_FILENAME}"
echo ""
echo "Verify the restore by running:"
echo "  psql \$DATABASE_URL -c 'SELECT COUNT(*) FROM leads;'"
