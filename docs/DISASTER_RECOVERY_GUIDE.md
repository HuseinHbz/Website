# HBZ Platform — Disaster Recovery Guide

**RTO (Recovery Time Objective):** < 15 minutes  
**RPO (Recovery Point Objective):** < 24 hours (daily backup)

---

## Scenario 1: Application Crash

**Symptoms:** Site unreachable, PM2 process stopped.

```bash
# Check status
pm2 status

# Restart
pm2 start ecosystem.config.js --only habibazar

# Verify
curl http://localhost:3000/api/health
./health-check.sh
```

**Expected recovery:** < 2 minutes

---

## Scenario 2: Bad Deployment (Build Broken)

**Symptoms:** Deployment succeeded but app crashes on start.

```bash
# Option A: Restore from .next.bak snapshot (if update.sh created one)
cd /var/www/habibazar-repo/outputs/habibazar-web
ls -la .next.bak    # confirm it exists
mv .next .next.broken
mv .next.bak .next
pm2 reload habibazar

# Option B: Roll back to previous Git commit
cd /var/www/habibazar-repo
git log --oneline -5     # find the last good commit
git checkout <COMMIT_SHA> -- outputs/habibazar-web/
cd outputs/habibazar-web
npm ci && npm run build
pm2 reload habibazar
```

**Expected recovery:** < 10 minutes

---

## Scenario 3: Database Corruption

**Symptoms:** App returns errors, health check shows DB `down`.

```bash
# Step 1: Check integrity
sqlite3 /var/data/habibazar/habibazar.db "PRAGMA integrity_check;"

# Step 2: Find latest backup
ls -lt /var/backups/habibazar/ | head -5

# Step 3: Stop app
pm2 stop habibazar

# Step 4: Restore DB
BACKUP_DIR=/var/backups/habibazar/YYYYMMDD_HHMMSS
gunzip -c $BACKUP_DIR/habibazar_*.db.gz > /var/data/habibazar/habibazar.db

# Step 5: Verify
sqlite3 /var/data/habibazar/habibazar.db "PRAGMA integrity_check;"

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
# On new server:

# 1. Install prerequisites
apt update && apt install -y nodejs npm nginx sqlite3
npm install -g pm2

# 2. Clone repository
git clone https://github.com/HuseinHbz/Website.git /var/www/habibazar-repo
cd /var/www/habibazar-repo && git checkout hbz

# 3. Restore .env.local from secure storage
# (store backups of .env.local in a password manager or secret vault)
cp /path/to/secure/.env.local outputs/habibazar-web/.env.local

# 4. Restore database from backup
mkdir -p /var/data/habibazar
scp old-server:/var/backups/habibazar/LATEST/habibazar_*.db.gz .
gunzip habibazar_*.db.gz -c > /var/data/habibazar/habibazar.db

# 5. Deploy
cd outputs/habibazar-deploy
chmod +x deploy.sh update.sh backup.sh health-check.sh
./deploy.sh

# 6. Configure Nginx (see DEPLOYMENT_GUIDE.md)
# 7. Point DNS to new server IP

```

**Expected recovery:** < 45 minutes  
**Data loss:** Up to 24 hours (last backup)

---

## Scenario 5: Compromised Admin Credentials

```bash
# Step 1: Immediately rotate JWT secret (invalidates ALL sessions)
NEW_SECRET=$(openssl rand -base64 48)
sed -i "s/^ADMIN_JWT_SECRET=.*/ADMIN_JWT_SECRET=$NEW_SECRET/" \
  /var/www/habibazar-repo/outputs/habibazar-web/.env.local
pm2 reload habibazar

# Step 2: Review audit logs for unauthorized actions
pm2 logs habibazar --lines 500 | grep AUDIT

# Step 3: Reset admin password via DB
sqlite3 /var/data/habibazar/habibazar.db \
  "UPDATE users SET password_hash = 'TEMPORARY_LOCKED' WHERE role = 'admin';"
# Then use the admin panel to set a new password after rotating the secret
```

---

## Backup Verification (Monthly)

```bash
# Pick a recent backup
BACKUP=/var/backups/habibazar/YYYYMMDD_HHMMSS/habibazar_*.db.gz

# Restore to temp location
gunzip -c $BACKUP > /tmp/hbz_test.db

# Verify integrity
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
