# Pilot Go-Live Plan — HBZ Platform

A step-by-step, low-risk plan to move the platform from staging into a real pilot
with a limited set of customers. Every mutating step is preceded by a backup and
followed by a verification, so any step is reversible.

## 0. Prerequisites (must be TRUE before starting)
Open **System → Go-Live Checklist** (`/admin/settings/onboarding`) and confirm all
**required** items are green:
- [ ] Company profile & branding filled (`/admin/company`)
- [ ] At least one product/service (`/admin/inventory`)
- [ ] At least one customer (`/admin/sales`)
- [ ] Email (SMTP) configured (`/admin/settings`)
- [ ] SMS provider configured — SMS.ir or Kavenegar (`/admin/settings`)
- [ ] Payment gateway (Zarinpal merchant id) (`/admin/settings`)

Optional but recommended: exchange rates (if multi-currency), portal help
articles, سامانه مودیان key (for real Iranian e-invoice submission).

### Items that require CUSTOMER-supplied credentials (blocked-external)
These cannot be completed by us — the customer must provide them:
- **Zarinpal merchant id** (online payment).
- **SMS provider API key** (SMS.ir / Kavenegar) for portal OTP + campaigns.
- **WhatsApp Cloud** token + phone id (Meta Business) and **Telegram** bot token.
- **سامانه مودیان** private key + memory id (real e-invoice POST).
- **SMTP** host/user/pass for outbound email.
Until each is set, that channel runs in deterministic **sandbox** mode.

## 1. Backup before every step
Before ANY step below, take a fresh encrypted backup and verify it:
```
bash deploy/backup.sh daily
bash deploy/restore-drill.sh      # dump → throwaway DB → validate → trial balance (prints RTO)
```
Do not proceed if the restore drill fails.

## 2. Order of operations
1. **Change the seeded admin password** and create per-person admin users with the
   least-privilege role (viewer/auditor/editor/administrator).
2. **Company + numbering + currency**: confirm company profile, numbering formats,
   base currency (IRR) and any FX rates.
3. **Master data**: import/verify products + customers (use the Import Center; do a
   **dry-run** first, then the real import).
4. **A single end-to-end rehearsal on DEMO data**:
   `npm run seed:demo` → walk the full cycle (lead → invoice → GL → portal login →
   online payment sandbox → ticket → SLA) → `npm run reset:demo` (removes ONLY
   `DEMO-` rows; real data untouched).
5. **Enable the portal** for a handful of pilot customers; send them the `/portal`
   link and confirm OTP login works with the real SMS/email provider.
6. **Go live** for the pilot cohort; monitor daily.

## 3. Success criteria (pilot is healthy when…)
- Portal OTP login works end-to-end for real customers (real SMS/email).
- A customer can view + pay an invoice online; the payment reconciles to
  `sales_payments` with method **`gateway`** and auto-posts a GL receipt.
- Support tickets flow: customer creates → agent replies → SLA timer + breach
  alerts behave; internal notes never leak to the customer.
- Books tie out: trial balance balanced; sales invoices auto-post to the GL.
- No 5xx under normal load; health probes green (`/api/health?probe=deep`).

## 4. Monitoring during the pilot
- **Operations → Logs & Monitoring** (live console + backup engine status).
- **Operational Health Center** (`/admin/health`) — self-heal + risk score.
- **CRM Dashboard** (`/admin/crm/dashboard`) — pipeline, no-activity leads,
  SLA-breached tickets, AR aging, campaign performance (MoM).

## 5. Rollback
If a step goes wrong:
- **App/deploy rollback** (zero-downtime): `bash deploy/deploy-blue-green.sh`
  performs a health-gated switch with a one-line rollback to the previous port.
- **Data rollback**: restore the pre-step backup —
  `bash deploy/restore.sh <file.enc> --yes` (snapshots the current DB first).
- **Import rollback**: any Import Center job can be rolled back
  (reverse-order transactional delete → status `rolled_back`).
- **GL corrections** are never destructive — void posts a balanced REVERSAL entry
  (two-way linked); posted journal entries are permanent audit records.

## 6. After the pilot
- Review the CRM dashboard + reports; expand the customer cohort gradually.
- Turn on any channels that were still in sandbox once real credentials arrive.
- Keep the 7 regression suites green in CI (`npm run regressions`) before every
  further change.
