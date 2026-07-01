# HBZ Platform — Security Checklist

## Pre-Deployment

- [ ] `ADMIN_JWT_SECRET` set to a strong random value (≥ 32 chars): `openssl rand -base64 48`
- [ ] `.env.local` is NOT committed to the repository
- [ ] `ADMIN_JWT_SECRET` does NOT match the default value in code
- [ ] All AI API keys are stored in `.env.local`, never hardcoded
- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] SSL certificate is valid and auto-renewing (Let's Encrypt)
- [ ] Nginx has TLS 1.2/1.3 only (no SSLv3, TLS 1.0, TLS 1.1)
- [ ] HSTS is enabled with preload
- [ ] `X-Frame-Options: DENY` header is present
- [ ] `X-Content-Type-Options: nosniff` header is present
- [ ] Content Security Policy is active (verify with browser DevTools)
- [ ] Admin panel accessible only from intended IPs (if Nginx IP restriction desired)

## Authentication

- [ ] Default admin credentials changed on first login
- [ ] Admin password is strong (≥ 16 chars, mixed case, numbers, symbols)
- [ ] JWT tokens expire (check `ADMIN_JWT_SECRET` and token generation)
- [ ] Login page rate-limited (10 attempts / 15 min per IP)
- [ ] Admin cookie: `HttpOnly`, `Secure`, `SameSite=Strict`

## Ongoing Security

- [ ] Run `npm audit` monthly
- [ ] Rotate `ADMIN_JWT_SECRET` every 90 days (invalidates all sessions)
- [ ] Review audit logs weekly (`pm2 logs habibazar | grep AUDIT`)
- [ ] Review security logs for repeated failures (`pm2 logs habibazar | grep SECURITY`)
- [ ] Monitor health endpoint daily
- [ ] Keep Node.js on latest LTS version

## Incident Response

If a breach is suspected:
1. Rotate `ADMIN_JWT_SECRET` immediately (all sessions invalidated)
2. Review audit logs for unauthorised actions
3. Check `/var/log/nginx/access.log` for anomalous patterns
4. Take database backup before any remediation
5. Restart application: `pm2 restart habibazar`
