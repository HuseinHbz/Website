# HBZ Platform — Operations Guide

## Daily Operations

### Monitoring

```bash
# View real-time logs
pm2 logs habibazar

# Health check
curl http://localhost:3000/api/health
curl "http://localhost:3000/api/health?detail=1"

# Process status
pm2 status

# Resource usage
pm2 monit
```

### Log Channels

| Channel | Filter | Purpose |
|---|---|---|
| General | `pm2 logs habibazar` | All logs |
| Errors | `pm2 logs habibazar \| grep ERROR` | Error events |
| Security | `pm2 logs habibazar \| grep SECURITY` | Auth failures, intrusion attempts |
| Audit | `pm2 logs habibazar \| grep AUDIT` | Admin actions (create/update/delete) |
| AI | `pm2 logs habibazar \| grep "AI chat"` | AI usage |

### Key Metrics to Watch

| Metric | Threshold | Action |
|---|---|---|
| Memory > 700 MB | Warning | `pm2 restart habibazar` |
| Disk > 80% | Warning | Clean old backups, logs |
| Disk > 90% | Critical | Immediate cleanup |
| Health status = `down` | Critical | Check DB, restart app |
| Repeated SECURITY log entries | Warning | Check for brute force |

---

## Scheduled Tasks

| Task | Schedule | Command |
|---|---|---|
| Database backup | Daily 3:00 AM | `sudo bash /var/www/habibazar/deploy/backup.sh` |
| Health check | Every 5 min | `bash /var/www/habibazar/deploy/health-check.sh` |
| Log rotation | Weekly | PM2 log rotate (`pm2 install pm2-logrotate`) |
| `npm audit` | Monthly | `npm audit --audit-level=high` |

---

## Common Operations

### Zero-downtime update
```bash
# Update from default branch (hbz)
sudo bash /var/www/habibazar/deploy/update.sh

# Update from a specific branch
sudo bash /var/www/habibazar/deploy/update.sh --branch feature/my-branch

# Restart only — skip rebuild
sudo bash /var/www/habibazar/deploy/update.sh --skip-build
```

### Restart application
```bash
pm2 reload habibazar   # Graceful reload (zero downtime)
pm2 restart habibazar  # Hard restart (brief downtime)
```

### Manual backup
```bash
sudo bash /var/www/habibazar/deploy/backup.sh
```

Backup is stored at `/var/backups/habibazar/YYYYMMDD_HHMMSS/` and contains:
- `habibazar.db` — SQLite database (hot backup via `sqlite3 .backup`)
- `uploads.tar.gz` — uploaded media files
- `.env.local.bak` — environment config

### View backup history
```bash
ls -lt /var/backups/habibazar/
```

### Restore from backup
```bash
APP_DIR=/var/www/habibazar/outputs/habibazar-web
BACKUP=/var/backups/habibazar/YYYYMMDD_HHMMSS

# Stop app
pm2 stop habibazar

# Restore DB
cp "$BACKUP/habibazar.db" "$APP_DIR/data/habibazar.db"

# Restore uploads (optional)
tar -xzf "$BACKUP/uploads.tar.gz" -C "$APP_DIR/public/"

# Restart
pm2 start habibazar
curl http://localhost:3000/api/health
```

### Rotate admin JWT secret (invalidates all sessions)
```bash
ENV_FILE=/var/www/habibazar/outputs/habibazar-web/.env.local

# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Update .env.local
sed -i "s/^ADMIN_JWT_SECRET=.*/ADMIN_JWT_SECRET=$NEW_SECRET/" "$ENV_FILE"

# Reload app (all admins will be logged out)
pm2 reload habibazar
```

---

## Troubleshooting

### App not responding
```bash
pm2 status                          # Check process state
pm2 logs habibazar --lines 50       # Check recent logs
curl http://localhost:3000/api/health
pm2 restart habibazar
```

### Database locked / corruption
```bash
DB=/var/www/habibazar/outputs/habibazar-web/data/habibazar.db

# Check DB integrity
sqlite3 "$DB" "PRAGMA integrity_check;"

# If corrupted, restore from backup (see above)
```

### High memory usage
```bash
pm2 restart habibazar
# PM2 is configured to auto-restart at 512 MB (max_memory_restart in pm2.config.js)
```

### Build fails during update
```bash
# update.sh auto-restores .next.bak if build fails.
# For manual recovery:
cd /var/www/habibazar/outputs/habibazar-web
[[ -d .next.bak ]] && mv .next.bak .next
pm2 reload habibazar
```

---

## Nginx Management

```bash
nginx -t                            # Test config
systemctl reload nginx              # Reload config
systemctl status nginx              # Check status
tail -f /var/log/nginx/error.log    # Error logs
```

## SSL Certificate Renewal (Let's Encrypt)

```bash
certbot renew --dry-run             # Test renewal
certbot renew                       # Renew
systemctl reload nginx
```
