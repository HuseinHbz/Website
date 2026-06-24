#!/bin/bash
set -euo pipefail

# Required env vars: DATABASE_URL, R2_BUCKET, R2_ENDPOINT, BACKUP_RETENTION_DAYS
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY must also be set

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="habibazar_backup_${TIMESTAMP}.sql.gz"
TMPFILE="/tmp/${FILENAME}"

echo "[$(date -Iseconds)] Starting backup: ${FILENAME}"

# Dump and compress
pg_dump "$DATABASE_URL" | gzip > "$TMPFILE"

# Verify the archive is valid
gzip -t "$TMPFILE"
echo "[$(date -Iseconds)] Backup compressed and verified: $(du -h "$TMPFILE" | cut -f1)"

# Upload to R2
aws s3 cp "$TMPFILE" "s3://${R2_BUCKET}/${FILENAME}" --endpoint-url="${R2_ENDPOINT}"
echo "[$(date -Iseconds)] Uploaded to R2: s3://${R2_BUCKET}/${FILENAME}"

# Remove local temp file
rm "$TMPFILE"

# Clean old backups beyond retention window
echo "[$(date -Iseconds)] Cleaning backups older than ${BACKUP_RETENTION_DAYS} days..."
CUTOFF_EPOCH=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%s 2>/dev/null || date -v "-${BACKUP_RETENTION_DAYS}d" +%s)

aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url="${R2_ENDPOINT}" | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $1}')
  FILE_NAME=$(echo "$line" | awk '{print $4}')

  if [ -z "$FILE_NAME" ]; then
    continue
  fi

  # Only process our backup files
  if [[ "$FILE_NAME" != habibazar_backup_*.sql.gz ]]; then
    continue
  fi

  FILE_EPOCH=$(date -d "$FILE_DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$FILE_DATE" +%s 2>/dev/null || echo "0")

  if [ "$FILE_EPOCH" -gt 0 ] && [ "$FILE_EPOCH" -lt "$CUTOFF_EPOCH" ]; then
    echo "[$(date -Iseconds)] Deleting old backup: ${FILE_NAME}"
    aws s3 rm "s3://${R2_BUCKET}/${FILE_NAME}" --endpoint-url="${R2_ENDPOINT}"
  fi
done

echo "[$(date -Iseconds)] Backup complete: ${FILENAME}"
