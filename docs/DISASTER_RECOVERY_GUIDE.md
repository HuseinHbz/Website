# HBZ Platform — Disaster Recovery Guide

**RTO (Recovery Time Objective):** < 30 minutes  
**RPO (Recovery Point Objective):** ≤ 1 hour (hourly database backup)

---

## Automated Backup & DR System

Set up automatically by `install.sh` (or `sudo bash deploy/backup-cron.sh`).

**What's backed up** — SQLite database (all tables/indexes/views/triggers live in
the file, snapshot via `.backup` + `PRAGMA integrity_check`), uploaded media
(`public/uploads`), and config (`.env.local`, nginx, pm2, package-lock, git SHA).
Each backup is **AES-256 encrypted**, **sha256-checksummed**, and **verified**
(decrypt + list) right after creation.

**Schedule & retention** (cron, runs as `hbz`):

| Bucket  | Frequency        | Scope | Retention |
|---------|------------------|-------|-----------|
| hourly  | every hour       | DB    | 48 hours  |
| daily   | 03:00            | full  | 30 days   |
| weekly  | Sun 02:00        | full  | 12 weeks  |
| monthly | 1st 01:00        | full  | 24 months |
| yearly  | Jan 1 00:30      | full  | 10 years  |

Expired backups are auto-purged. A **weekly automated recovery test** (Mon 04:00)
restores the latest daily backup into an isolated temp dir and validates integrity.

**Create / restore manually:**
```bash
sudo -u hbz bash deploy/backup.sh daily          # create
sudo bash deploy/restore.sh <file.enc> --test    # recovery test (safe)
sudo bash deploy/restore.sh <file.enc>           # real restore (snapshots current DB first)
```

**Encryption key:** `/home/hbz/.backup-key` — **store a copy off-server**; without
it backups cannot be decrypted. Monitor status in the admin panel → *Backup & Recovery*.

**3-2-1:** local buckets give multiple copies over time; set `BACKUP_REMOTE`
(an rclone remote or rsync target) to push the encrypted copy **offsite** — this
is the one piece that needs your credentials/remote to be configured.

> Scope notes: SQLite has no separate roles/extensions/stored-procedures to back
> up (all schema objects are inside the `.db` file). "Full server snapshot" and
> restoring into a fresh VM are documented procedures below, not app-automated.

---

## Scenario 1: Application Crash

**Symptoms:** Site unreachable, PM2 process stopped.

```bash
# Check status
pm2 status

# Restart
pm2 restart habibazar

# Verify
curl http://localhost:3000/api/health
bash /var/www/habibazar/deploy/health-check.sh
```

**Expected recovery:** < 2 minutes

---

## Scenario 2: Bad Deployment (Build Broken)

**Symptoms:** Deployment succeeded but app crashes on start.

```bash
WEB_DIR=/var/www/habibazar/outputs/habibazar-web

# Option A: Restore from .next.bak snapshot (created by update.sh before each build)
ls -la "$WEB_DIR/.next.bak"   # confirm it exists
mv "$WEB_DIR/.next" "$WEB_DIR/.next.broken"
mv "$WEB_DIR/.next.bak" "$WEB_DIR/.next"
pm2 reload habibazar

# Option B: Roll back to previous Git commit
APP_DIR=/var/www/habibazar
git -C "$APP_DIR" log --oneline -5       # find the last good commit
git -C "$APP_DIR" reset --hard <COMMIT>  # roll back
cd "$WEB_DIR"
npm ci --omit=dev && npm run build
pm2 reload habibazar
```

**Expected recovery:** < 10 minutes

---

## Scenario 3: Database Corruption

**Symptoms:** App returns errors, health check shows DB `down`.

```bash
DB=/var/www/habibazar/outputs/habibazar-web/data/habibazar.db

# Step 1: Check integrity
sqlite3 "$DB" "PRAGMA integrity_check;"

# Step 2: Find latest backup
ls -lt /var/backups/habibazar/ | head -5

# Step 3: Stop app
pm2 stop habibazar

# Step 4: Restore DB
BACKUP_DIR=/var/backups/habibazar/YYYYMMDD_HHMMSS
cp "$BACKUP_DIR/habibazar.db" "$DB"

# Step 5: Verify
sqlite3 "$DB" "PRAGMA integrity_check;"

# Step 6: Restart
pm2 start habibazar
curl http://localhost:3000/api/health
```

**Expected recovery:** < 10 minutes  
**Data loss:** Up to 24 hours (last backup)

---

## Scenario 4: Server Failure (Full Server Recovery)

**Symptoms:** Server completely lost.

```bash
# On new server (Ubuntu 22.04):

# 1. Clone repository and run install script
git clone https://github.com/HuseinHbz/Website.git /var/www/habibazar
sudo bash /var/www/habibazar/deploy/install.sh

# 2. Restore .env.local from secure storage
cp /path/to/secure/.env.local /var/www/habibazar/outputs/habibazar-web/.env.local

# 3. Restore database from backup
DB=/var/www/habibazar/outputs/habibazar-web/data/habibazar.db
BACKUP=/path/to/backup/habibazar.db
pm2 stop habibazar
cp "$BACKUP" "$DB"
chown hbz:hbz "$DB"

# 4. Rebuild and start
cd /var/www/habibazar/outputs/habibazar-web
sudo -u hbz npm run build
pm2 start habibazar

# 5. Point DNS to new server IP
```

**Expected recovery:** < 45 minutes  
**Data loss:** Up to 24 hours (last backup)

---

## Scenario 5: Compromised Admin Credentials

```bash
ENV_FILE=/var/www/habibazar/outputs/habibazar-web/.env.local
DB=/var/www/habibazar/outputs/habibazar-web/data/habibazar.db

# Step 1: Immediately rotate JWT secret (invalidates ALL sessions)
NEW_SECRET=$(openssl rand -hex 32)
sed -i "s/^ADMIN_JWT_SECRET=.*/ADMIN_JWT_SECRET=$NEW_SECRET/" "$ENV_FILE"
pm2 reload habibazar

# Step 2: Review audit logs for unauthorized actions
pm2 logs habibazar --lines 500 | grep AUDIT

# Step 3: Lock all admin accounts temporarily
sqlite3 "$DB" "UPDATE users SET password_hash = 'LOCKED' WHERE role != 'super_admin';"
# Then reset passwords via admin panel after rotating the secret
```

---

## Backup Verification (Monthly)

```bash
# Pick a recent backup
BACKUP=/var/backups/habibazar/YYYYMMDD_HHMMSS/habibazar.db

# Restore to temp location and verify
cp "$BACKUP" /tmp/hbz_test.db
sqlite3 /tmp/hbz_test.db "PRAGMA integrity_check; SELECT COUNT(*) FROM users;"

# Clean up
rm /tmp/hbz_test.db
```

---

## Emergency Contacts

| Role | Contact |
|---|---|
| Platform Owner | info@habibazar.ir |
| Server Provider | (your VPS provider support) |
| SSL Cert | Let's Encrypt / certbot |
