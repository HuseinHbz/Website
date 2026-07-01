# HBZ Platform — Monitoring Guide

## Health Endpoint

```bash
# Basic health
GET /api/health
# Response: { "status": "ok", "ts": "...", "version": "2.0.0", "uptime": 3600, "env": "production" }

# Detailed health (includes memory breakdown, all checks)
GET /api/health?detail=1
# Response: { ...basic, "checks": [{ "name": "database", "status": "ok", "latencyMs": 2 }, ...] }
```

### Status Values

| Status | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | All systems operational |
| `degraded` | 200 | Non-critical issue (e.g. high memory) |
| `down` | 503 | Critical failure (e.g. DB unreachable) |

---

## Log Structure (Production JSON)

```json
{
  "ts": "2026-07-01T12:00:00.000Z",
  "level": "info",
  "msg": "GET /api/health 200 3ms",
  "method": "GET",
  "path": "/api/health",
  "statusCode": 200,
  "duration": 3
}
```

### Log Levels

| Level | `LOG_LEVEL` env | Use |
|---|---|---|
| `debug` | `debug` | Detailed dev info |
| `info` | `info` (default) | Normal operations |
| `warn` | `warn` | Rate limits, retries, slow responses |
| `error` | `error` | Errors requiring attention |

---

## Key Log Patterns

```bash
# All errors in last hour
pm2 logs habibazar --lines 1000 | grep '"level":"error"'

# Security events (auth failures, rate limits)
pm2 logs habibazar | grep 'SECURITY'

# Audit trail (admin creates/updates/deletes)
pm2 logs habibazar | grep 'AUDIT'

# AI usage
pm2 logs habibazar | grep '"msg":"AI chat"'

# Slow API responses (>1000ms)
pm2 logs habibazar | grep '"duration"' | awk -F'"duration":' '{if ($2+0 > 1000) print}'
```

---

## Alerting Rules

Set up cron-based alerts using `health-check.sh`:

```bash
# Alert via email on health failure
ALERT_EMAIL=admin@habibazar.ir ./health-check.sh https://habibazar.ir

# Or check exit code in a cron wrapper
*/5 * * * * /path/to/health-check.sh || echo "ALERT: HBZ health check failed" | mail -s "HBZ Down" admin@habibazar.ir
```

### Recommended Alert Thresholds

| Condition | Severity | Action |
|---|---|---|
| Health `down` | Critical | Immediate: restart, then investigate |
| Health `degraded` for >15min | High | Investigate memory/DB |
| 3+ SECURITY events in 5min | High | Review IP, consider block |
| Disk > 85% | Medium | Clean logs/backups |
| `pm2 status` shows `errored` | Critical | `pm2 restart habibazar` |

---

## PM2 Monitoring

```bash
# Real-time dashboard
pm2 monit

# Process list with memory/CPU
pm2 list

# Log streaming
pm2 logs habibazar

# Flush logs
pm2 flush habibazar

# Install log rotation (run once)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Nginx Access Logs

```bash
# Live access log
tail -f /var/log/nginx/access.log

# Top IPs by request count
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# 5xx errors
grep ' 5[0-9][0-9] ' /var/log/nginx/access.log | tail -50

# Slow requests (if Nginx is configured with $request_time)
awk '$NF > 3' /var/log/nginx/access.log | tail -20
```

---

## Circuit Breaker Status

The circuit breakers (AI, SMTP, Search) are in-memory and reset on restart. To check state:

```bash
# Hit the detailed health endpoint — future versions will expose circuit state
curl "http://localhost:3000/api/health?detail=1" | python3 -m json.tool

# Or check logs for OPEN state
pm2 logs habibazar | grep 'Circuit breaker OPEN'
```

---

## Capacity Planning

| Resource | Current Limit | Scale Action |
|---|---|---|
| Concurrent users | ~500 (SQLite WAL) | Switch to PostgreSQL |
| Rate limit (API) | 120 req/min/IP | Increase or add Redis |
| Memory | 768 MB (PM2 restart) | Increase or add workers |
| Storage | Monitor with `df -h` | Clean backups or expand disk |
| AI requests | 20 req/min/IP | Adjust `limiters.ai` in `rateLimit.ts` |
