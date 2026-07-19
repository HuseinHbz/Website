# Phase 26.7 — Enterprise ERP Final UX, Currency Architecture & Document Engine (Report)

Audit-first closure of the ERP UX/currency/permission/system-management issues.
No module was rewritten; every fix reuses the existing architecture, is
PostgreSQL-native, backward-compatible, unit-tested and verified against a
fresh live PostgreSQL database.

## 1. Navigation duplicate-active fix ✅
- **Root cause (audited)**: workspace quick actions ("فاکتور جدید", "کالای
  جدید", "سند حسابداری جدید", …) shared the exact same `href` as their module
  items ("مرکز فروش", …) and `NavLink` used a `startsWith` check — so both
  always highlighted together.
- **Navigation Resolver Engine** (`src/lib/admin/workspaces.ts`): pure
  `hrefPath` / `hrefMatches` (path-boundary safe) / `resolveActiveHref`
  (exact match wins → else the longest nested match; ONE winner across nav
  groups + favorites + recents + quick actions). Applied in `AdminSidebar`.
- **Unique route identity** for every quick action: `/admin/sales?new=invoice`,
  `/admin/inventory?new=product`, `/admin/finance?new=journal` (+ all other
  workspaces). Action links never activate; the three ERP deep links really
  open the target tab **and** its create modal (Sales invoice / Inventory
  product / Finance journal entry).
- **Navigation Regression Test**: `src/lib/admin/__tests__/navResolver.test.ts`
  (10 tests: exact/nested/boundary/action-link/no-duplicate guarantees).

## 2–3. Enterprise currency management + multi-currency transactions ✅
- **`erp_settings`** table (idempotent seed): `default_currency=IRR`,
  `display_currency=IRR`, `decimal_precision=0`, `number_format` + server
  loader `src/lib/erp/settings.ts` (cached) + `GET/PUT /api/admin/erp/settings`
  (manage_settings, audited) + a **Global currency configuration** card in
  Finance → Currency (default/display currency + decimals).
- **Default currency is now IRR platform-wide** and configurable — the USD
  hardcodes in the document engine, document creation and preview are gone.
- **`formatCurrency()` standard** (`src/lib/format.ts`): `1,000,000 ریال` ·
  `100,000 تومان` · `$1,000` · `€1,000`; `fmtMoney` (already used by all 7
  money-rendering admin modules) now delegates to it, configured once per
  session by `AdminShell` from the ERP settings — hardcoded `$` eliminated.
- **Multi-currency transaction engine**: idempotent columns
  `currency`/`exchange_rate`/`base_total` on `sales_documents` (+
  `purchase_documents` completed), `currency`/`exchange_rate` on
  `gl_journal_entries`, `sales_payments`, `purchase_payments`, `currency` on
  `assets`. `rialRateFor(code)` resolves the Rial rate (IRR=1, IRT=10 exact,
  USD/EUR from the daily `erp_exchange_rates`; **null when unset** → the API
  rejects with "set a rate" instead of silently booking 1:1). Currency selects
  added to the sales document modal, journal editor, sales payments and the
  assets API; purchasing already had one (now persisted with rate + base).
- Dashboards/KPIs render through `fmtMoney` → amount + currency symbol follow
  the configured display currency.

## 4. Sales Center delete permission fix ✅
- **Root cause (audited)**: the DELETE API existed (already RBAC-gated:
  `canDo('delete')` = super_admin + administrator, editors excluded) but the
  Sales UI had **no delete action**, and deletion was hard.
- **Soft delete**: `deleted_at`/`deleted_by`/`delete_reason` columns; DELETE
  now updates them + sets `status='void'` (so every existing financial
  aggregate keeps excluding deleted docs unchanged — backward compatible),
  records the reason in the audit trail, and refuses paid documents. Lists
  and detail hide `deleted_at IS NOT NULL` rows. UI: Delete row action with a
  reason prompt (server enforces the role matrix).

## 5–7. Invoice Template Center, branding, invoice types, template engine ✅
- **20 new invoice templates** seeded idempotently across the mandated
  categories — Professional (4) · Corporate (4) · Minimal (3) · Retail (3) ·
  International (3) · Iranian Accounting (3) — each a designer-editable
  `doc_templates` row (accent, variant label, watermark, logo/seal/signature/
  QR/barcode toggles, terms, payment instructions, footer). With the 4 legacy
  templates: 24 total, all selectable at generation and editable in the
  Invoice Designer with live preview.
- **Branding**: `company_ceo` added to the Company Profile (site_settings) and
  printed as the signature title fallback; logo/legal identity/registration/
  economic code/address/phone/email/website/signature/stamp already existed
  (Phase 26) and are reused.
- **Invoice types حقیقی/حقوقی**: already built in Phase 26.2 (customer `kind`
  + national_id/reg_no/economic_code printed on documents) — audited, verified
  and reused per the already-exists rule.
- **Template engine for all documents**: three new generated-document types —
  **Receipt (RC)**, **Payment Voucher (PV)**, **Journal Voucher (JV)** — join
  invoice/quotation/purchase-order/… on the same Template Engine + Renderer +
  Brand Profile + Currency Formatter stack, with their own numbering prefixes
  and bilingual type labels.

## 8. System Management fix ✅
- **Root cause (audited)**: nav visibility was fine (10 items for admins), but
  `/admin/dashboards/system` had **no widgets and no preset layout** → the
  workspace dashboard rendered an empty card ("هیچ گزینه‌ای").
- Dashboard Engine now renders the workspace's **real module grid** (RBAC
  links) whenever a layout is empty — no workspace can render blank.
- System workspace gained the mandated pages (all real routes): Company
  Profile (`/admin/company`), Currency Settings (`/admin/finance?tab=currency`
  deep link), Document Settings (`/admin/documents?view=designer` deep link),
  Security Settings (`/admin/security`), Audit & Logs
  (`/admin/logs-monitoring`) — plus the existing System Settings (email/SMTP
  lives there), Numbering, Flags, SEO, Organization group.

## 9. Currency formatting standard ✅
Single `formatCurrency()`/`fmtMoney()` (see §2) — all module UIs use it; the
document engine's `money()` follows the same rules for print output.

## 10. Verification ✅
- TypeScript 0 · ESLint 0 · **368 unit tests** green (incl. 10 nav-regression,
  5 formatCurrency) · 7 governance audits pass · production build clean.
- **Live PostgreSQL round-trip (fresh DB, 10 tests)**: erp_settings IRR seed +
  edit; IRR=1/IRT=10 exact + USD/EUR daily rates (+ honest null before a rate
  exists); invoices generated in **IRR / IRT / USD / EUR** each rendering its
  own symbol (ریال/تومان/$/€); purchase invoice persists exchange_rate 600,000
  and base_total in Rial; all new columns present; 24 templates seeded (3
  Iranian); `retail-pos` template drives accent + barcode in the render;
  receipt/payment-voucher/journal-voucher generate with own numbering; soft
  delete records who/when/why, voids and hides the document.

## Remaining issues (documented honestly)
- Editors still *see* the Delete action (the server rejects them with 403);
  hiding it client-side needs the user role plumbed into SalesCenter — the
  security control itself is server-side and correct.
- `number_format=compact` is stored but not yet consumed by the formatter
  (standard grouping only).
- USD/EUR conversion uses the latest daily rate at save time; historical
  revaluation of open documents is out of scope.
