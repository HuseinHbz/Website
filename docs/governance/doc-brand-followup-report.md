# DOC-BRAND follow-up — Document Center review + fixes

Follow-up to `doc-brand-report.md` (commit `138410f`), triggered by a live
screenshot report against the Invoice Designer preview. Six items, all
addressed with real evidence (live PostgreSQL, real `next start` server,
Playwright screenshots) — not unit tests alone.

## بند ۱ — Logo not appearing

**Root cause found and fixed.** `.header-logo { filter: brightness(0)
invert(1); }` assumed every uploaded logo is a transparent-background PNG
whose only opaque pixels form the mark — it force-converted ANY logo into a
flat white silhouette. A real-world logo with an opaque/colored background
(the overwhelmingly common case for a raw upload) collapsed into a plain
white rectangle — exactly the "logo isn't placed" symptom in the reported
screenshot.

**Fix**: the logo now sits inside a small white rounded card
(`.header-logo-chip`) on the dark header, at its natural colors — legible
against the navy background for *any* uploaded file, transparent or not, no
filter guessing required.

Verified live: uploaded a solid-red opaque test PNG via the real
`PUT /api/admin/settings` path (the same one `CompanyProfile.tsx` uses),
re-rendered a real invoice — before the fix the header showed nothing at that
position; after, the true logo (a plain white card holding the red square)
renders correctly. Screenshots taken via Playwright against a live `next
start` build on real PostgreSQL.

## بند ۲ — "Project Info" card wrongly fixed on commercial documents

**Root cause**: the second info card's title was hardcoded to "Project
info" regardless of document type. A sales invoice/quotation doesn't need
project info — it needs the seller's identity; project info belongs on
contracts/proposals.

**Fix**: `PROJECT_TYPED = new Set(['contract', 'proposal'])` in
`documents.ts` — those two types show "اطلاعات پروژه" / "PROJECT DETAILS";
every other type (invoice, quotation, PO, receipt, …) shows "اطلاعات
فروشنده" / "SELLER INFORMATION".

Verified live: a rendered invoice shows "اطلاعات فروشنده", a rendered
contract shows "اطلاعات پروژه" — never the other, for either doc type, fa
and en.

## بند ۳ — Whole-design review (designer / buyer / seller)

Performed as part of this pass, alongside the specific fixes above:
- **Designer**: the Invoice Designer's config panel already had separate
  "Payment instructions" / "Terms & conditions" fields — only the RENDER
  OUTPUT was merging them (see بند ۴). No designer-side gap found.
- **Buyer**: the buyer-facing card previously always said "Project info"
  even on a document with nothing to do with a project (بند ۲) and had no
  way to declare حقیقی vs حقوقی identity (بند ۵) — both fixed.
- **Seller**: the seller had no dedicated, correctly-labeled slot on
  commercial documents at all before this pass — fixed by بند ۲; the seller
  card sources from Company Profile (`loadCompanyProfile`), which already
  existed and needed no further change.

## بند ۴ — Payment instructions / terms & conditions "jumbled"

**Root cause**: a single `<div class="terms-box">` wrapped BOTH free-text
fields under one shared heading — visually the two concepts ran together
with no separation.

**Fix**: two independently-headed `.terms-section` blocks inside the same
box, with a dashed divider between them when both are present:
"دستور پرداخت" (Payment Instructions) above, "شرایط و ضوابط" (Terms &
Conditions) below — each only renders when it has content.

Verified live + visually (Playwright screenshot): both sections render with
distinct headings and a clear divider, never merged.

## بند ۵ — حقیقی / حقوقی selectable buyer-identity option

**Built**: a shared pure function `buildLegalIdentityLines(ids, rtl)` in
`documents.ts` — an individual (حقیقی) shows only their national ID; a
company (حقوقی) shows registration no. / national ID / economic code / tax
no. This replaces duplicated inline logic and is now the single source for
both:
- the **sales-sourced** path (`documentData.ts`), which already had a
  `kind` on `sales_customers` and now calls the shared function instead of
  reimplementing the label set;
- the **manual-composition** path, which previously had NO way to declare
  this at all. `CreateInput.partyIds` was added end-to-end: the API schema
  (`route.ts` — this schema was the actual bug that initially made the
  payload silently vanish, see below), `createDocument`, and a real UI
  picker in `DocumentCenter.tsx`'s manual-composition form (a Select: none /
  individual / company, with conditional Input fields for the IDs).

**A second real bug found and fixed during verification**: the API route's
zod schema (`src/app/api/admin/erp/documents/route.ts`) was never updated
to include `dueDate`/`partyIds` — `readJson` silently stripped both fields
from every request before `createDocument` ever saw them. The backend
plumbing was correct in isolation (unit-tested), but the field never reached
the database through the real HTTP path. Found only because this round's
live-server verification posted a real payload through the real route,
rather than calling `createDocument` directly — confirming why the
CLAUDE.md rule against "unit tests only" verification exists.

Verified live: a company-kind invoice shows all four identifiers (شماره
ثبت، شناسه ملی، کد اقتصادی، شماره مالیاتی); an individual-kind document
shows only the national ID; a document with `partyKind: 'none'` behaves
exactly as before (free-text `partyInfo` only) — zero regression for an
operator who ignores the new option.

### Related: due date

While reviewing what belongs on a commercial document vs. a contract, found
the header only ever printed the issue date — no due date / validity
deadline anywhere. Added as an optional first-class field: `gen_documents.
due_date` (new column, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, nullable,
never retroactively populated), threaded through `createDocument` →
`loadDocumentRow` → `renderDocument` → `DocModel.dueDate`, rendered as a
conditional header-meta row (Jalali + fa-IR digits when rtl, ISO/Latin
otherwise) only when set. A manual-composition date-input was added in the
UI; a sales-sourced document leaves it unset (no due-date concept currently
modeled on `sales_documents` — not invented here).

## بند ۶ — Test the whole Document Center, fix all bugs

All 13 document types (invoice, quotation, purchase_order, contract,
proposal, warranty, delivery_note, service_report, completion_certificate,
financial_report, receipt, payment_voucher, journal_voucher) were created
and rendered against a real running server + real PostgreSQL — all 13
returned HTTP 200 with no render failures.

Also re-verified, unaffected by this round's changes (no code path
touched):
- the public `/[locale]/verify/[code]` page still resolves a real document
  correctly ("معتبر"/valid, correct number);
- the customer-portal invoice print route (`/api/portal/invoices/[id]/
  print`) still routes through the same shared `renderDocumentHtml` engine
  — the logo/due-date/label fixes apply there automatically with no
  portal-specific code change needed.

## Bugs found and fixed this round

1. **Logo silhouette bug** (بند ۱) — `documents.ts`, real production-visible
   defect.
2. **Second-card mislabeling** (بند ۲) — `documents.ts`.
3. **Merged payment/terms box** (بند ۴) — `documents.ts`.
4. **No حقیقی/حقوقی option on manual documents** (بند ۵) — `documents.ts`,
   `documentData.ts`, `DocumentCenter.tsx`.
5. **API route silently dropping `dueDate`/`partyIds`** (بند ۵, found during
   live verification) — `route.ts`. This is the class of bug the
   maintainer's "never verify with unit tests alone" rule exists to catch.
6. **Missing due-date field** (related to بند ۵) — schema + full plumbing.

## Files changed
- `src/lib/erp/documents.ts` — logo chip, second-card label, terms/payment
  split, `buildLegalIdentityLines`, due-date row.
- `src/lib/erp/documentData.ts` — `CreateInput.dueDate`/`partyIds`, shared
  legal-identity call on both paths, `due_date` read/write.
- `src/app/api/admin/erp/documents/route.ts` — zod schema gained
  `dueDate`/`partyIds` (the real bug).
- `src/app/admin/documents/DocumentCenter.tsx` — due-date input, buyer-
  identity Select + conditional ID inputs, state + payload wiring.
- `src/lib/db/migrate.ts` — `gen_documents.due_date` column (idempotent,
  nullable, never backfilled).
- `src/lib/erp/__tests__/documents.test.ts` — 7 new test cases (22 total in
  this file), covering every fix above.

## Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` (full suite) | 1292/1292 passed |
| `npm run lint` | 0 warnings/errors |
| `npm run build` | clean |
| `npm run audit` (9 governance audits) | all clean/budget-0 |
| Live PostgreSQL + real `next start` server | all 13 doc types create + render HTTP 200; company/individual legal-ID lines confirmed; due-date row confirmed; seller-vs-project label confirmed both types/locales; payment/terms split confirmed; logo-chip fix confirmed by Playwright screenshot before/after |
| Public verify page | confirmed resolves a real generated document |
| Portal print route | confirmed unaffected/inherits fixes via the shared engine |

No item from the six-part report was left partial or deferred.
