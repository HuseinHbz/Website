# Habibazar API — Operations Runbook

## Health Checks

### Liveness
```bash
curl https://api.habibazar.ir/health
# Expected: {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Readiness (DB connectivity)
```bash
curl https://api.habibazar.ir/ready
# Expected: {"status":"ok","db":"connected"}
# On failure: HTTP 503 {"status":"error","db":"disconnected"}
```

### Check logs
```bash
# PM2 logs
pm2 logs habibazar-api --lines 100

# Pino structured logs (pipe through jq)
pm2 logs habibazar-api --raw 2>&1 | tail -f | jq '.'
```

---

## PM2 Operations

### Start / Restart
```bash
pm2 start ecosystem.config.js
pm2 restart habibazar-api
pm2 reload habibazar-api    # Zero-downtime reload
pm2 stop habibazar-api
pm2 delete habibazar-api
```

### Status
```bash
pm2 status
pm2 show habibazar-api
pm2 monit
```

### Example ecosystem.config.js
```js
module.exports = {
  apps: [{
    name: 'habibazar-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/log/habibazar-api/error.log',
    out_file: '/var/log/habibazar-api/out.log'
  }]
};
```

---

## Database Backup & Restore

### Manual backup
```bash
cd /opt/habibazar-api
source .env
./scripts/backup.sh
```

### Scheduled backup (cron)
```bash
# Run daily at 2:00 AM
0 2 * * * cd /opt/habibazar-api && source .env && ./scripts/backup.sh >> /var/log/habibazar-backup.log 2>&1
```

### List available backups
```bash
aws s3 ls "s3://${R2_BUCKET}/" --endpoint-url="${R2_ENDPOINT}" | sort -r | head -20
```

### Restore from backup
```bash
./scripts/restore.sh habibazar_backup_20240101_020000.sql.gz
```

### DB cleanup job
```bash
# Run cleanup manually
npm run db:cleanup

# Schedule (weekly)
0 3 * * 0 cd /opt/habibazar-api && npm run db:cleanup >> /var/log/habibazar-cleanup.log 2>&1
```

---

## DB Schema Hardening

After initial migrations:
```bash
npm run db:hardening
```

This creates:
- Partial unique indexes for slug columns (allows slug reuse after soft-delete)
- Lead score CHECK constraint (0–100)
- pgvector HNSW index for AI embeddings

---

## Secret Rotation

### Rotate JWT secrets
1. Generate new secrets:
   ```bash
   openssl rand -hex 32  # ACCESS_TOKEN_SECRET
   openssl rand -hex 32  # REFRESH_TOKEN_SECRET
   ```
2. Update `.env`
3. Reload app: `pm2 reload habibazar-api`
4. All existing refresh tokens immediately invalidated (users must re-login)

### Rotate ENCRYPTION_KEY
> **Warning**: All encrypted 2FA secrets become unreadable. Disable 2FA for all users first.
1. Disable 2FA for all users via admin panel
2. Generate new key: `openssl rand -hex 32`
3. Update `.env` with new `ENCRYPTION_KEY`
4. Reload app

### Rotate database password
1. Update PostgreSQL: `ALTER USER habibazar PASSWORD 'new_password';`
2. Update `DATABASE_URL` in `.env`
3. Reload app

### Rotate SMTP credentials
1. Update `SMTP_USER`, `SMTP_PASS` in `.env`
2. Reload app (no service disruption — connections are per-send)

---

## Common Failure Modes

### API returns 503 on `/ready`
- **Cause**: Database connection failure
- **Check**: `psql $DATABASE_URL -c 'SELECT 1'`
- **Fix**: Check PostgreSQL service, credentials, network

### High memory usage
- **Check**: `pm2 monit`
- **Fix**: `pm2 restart habibazar-api`
- Investigate memory leak with `node --inspect`

### Rate limit errors (429)
- AI endpoints: 10/min per IP
- Auth endpoints: 5/min per IP
- Public endpoints: 30/min per IP
- Fix: Upgrade to Redis-backed rate limiter for production clustering

### Emails not sending
- **Check SMTP**: `telnet smtp.example.com 587`
- **Check credentials**: Verify `SMTP_USER`, `SMTP_PASS`
- **Check logs**: `pm2 logs habibazar-api | grep mailer`
- Note: Email failures are non-blocking (leads still created)

### AI streaming not working
- Check `AI_PROVIDER` env and API key
- Check `AI_TIMEOUT_MS` (default 60s)
- Check `AI_MAX_TURNS` limit per conversation
- Verify SSE is not buffered by nginx: add `proxy_buffering off;`

### Nginx configuration for SSE
```nginx
location /api/v1/ai/conversations/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Prisma Migrations

```bash
# Create migration
npx prisma migrate dev --name describe_change

# Deploy to production (non-interactive)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Seed admin user (first-time setup)
npx tsx src/scripts/seed.ts
```

---

## Monitoring Checklist

Daily:
- [ ] Check `/ready` endpoint
- [ ] Review error logs
- [ ] Monitor disk space (backups)

Weekly:
- [ ] Review audit logs for anomalies
- [ ] Check failed login attempts
- [ ] Verify backup integrity

Monthly:
- [ ] Rotate secrets if policy requires
- [ ] Review and prune old sessions
- [ ] Check AI conversation retention
