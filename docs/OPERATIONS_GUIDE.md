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
| Database backup | Daily 3:00 AM | `./backup.sh` |
| Health check | Every 5 min | `./health-check.sh` |
| Log rotation | Weekly | PM2 log rotate (`pm2 install pm2-logrotate`) |
| `npm audit` | Monthly | `npm audit --audit-level=high` |

---

## Common Operations

### Zero-downtime update
```bash
./update.sh                          # Deploy latest from hbz branch
./update.sh feature/my-branch       # Deploy specific branch
```

### Restart application
```bash
pm2 reload habibazar   # Graceful reload (zero downtime)
pm2 restart habibazar  # Hard restart (brief downtime)
```

### Manual backup
```bash
./backup.sh                         # Full backup (DB + media + config)
./backup.sh --db-only               # DB only
./backup.sh --dest /tmp/my-backup   # Custom destination
```

### View backup history
```bash
ls -la /var/backups/habibazar/
cat /var/backups/habibazar/YYYYMMDD_HHMMSS/MANIFEST.txt
```

### Restore from backup
```bash
# Stop app temporarily
pm2 stop habibazar

# Restore DB
gunzip -c /var/backups/habibazar/TIMESTAMP/habibazar_TIMESTAMP.db.gz > /var/data/habibazar/habibazar.db

# Restart
pm2 start habibazar
pm2 save
```

### Rotate admin JWT secret (invalidates all sessions)
```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 48)

# Update .env.local
sed -i "s/^ADMIN_JWT_SECRET=.*/ADMIN_JWT_SECRET=$NEW_SECRET/" /var/www/habibazar-repo/outputs/habibazar-web/.env.local

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
# Check DB integrity
sqlite3 /var/data/habibazar/habibazar.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
# (see Restore from backup above)
```

### High memory usage
```bash
pm2 restart habibazar               # Clears in-memory rate limiter and circuit breakers
# PM2 is configured to auto-restart at 768 MB
```

### Build fails during update
```bash
# The update.sh script auto-restores .next.bak on build failure
# If .next.bak is missing:
cd /var/www/habibazar-repo
git stash                           # Save local changes
git checkout hbz
npm ci
npm run build
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
