# DOC-BRAND — Invoice/Document Persian-locale fixes + logo management

**Status:** correction pass, not a rebuild. "DOC-BRAND-1", an `InvoiceLetterhead`
component, "Document Studio", and `public/brand/logo-full.png` do **not exist**
anywhere in this codebase — the task brief assumed a prior phase that was never
built here. Confirmed by repo-wide search before any code was touched (بند ۰
below). The real, existing engine is `renderDocumentHtml`
(`src/lib/erp/documents.ts`, built in the prior session as the unified HBZ
letterhead design) — this phase fixes real, verified bugs in and around it, and
closes one genuinely missing feature (logo upload in Company Profile). No
vector logo was fabricated from a raster mockup (see بند ۱).

## بند ۰ — Audit: real state of every render/print path

| Path | Before this phase | After |
|---|---|---|
| `/api/admin/erp/documents/render` GET (open a generated document) | Called `renderDocumentHtml` — already correct engine | Unchanged, benefits from the engine-level fixes below |
| `/api/admin/erp/documents/render` POST (Invoice Designer live preview) | Hardcoded English demo data (`'Enterprise infrastructure service'`, `'Reference'`, `title: 'INVOICE'`) regardless of the template being previewed — **this is the exact source of the reported screenshot** | Demo data now locale-matched to `template.rtl` |
| `createDocument` (`documentData.ts`, real sales-sourced/manual documents) | Buyer legal-identity labels ("Reg. no", "National ID", …) and the "Reference" meta label hardcoded English; `title` fallback always `defaultTitle(type)` → English | Resolved from the chosen template's `rtl` flag (default: the Persian unified template); `defaultTitle(type, rtl)` |
| `renderDocumentHtml` itself | `money()`/dates always Latin digits/Gregorian regardless of `rtl` | fa-IR digits + Jalali date conversion built into the engine — every caller gets it automatically |
| `/api/portal/invoices/[id]/print` (customer portal) | **A second, completely independent hand-rolled HTML template** — no HBZ letterhead, same Latin-digit bug, English-shaped design (R7 violation, found by this audit) | Rewritten to build a `DocModel` and call the SAME `renderDocumentHtml` — duplicate template deleted, not patched twice |
| Company branding/logo | `company_logo_url` (+3 siblings) already read from `site_settings` via `loadCompanyProfile()` at render time — **not hardcoded**, contrary to the task's premise. But the admin UI only offered a plain URL text box (no upload/preview) | `CompanyProfile.tsx`'s 4 image fields upgraded to `MediaPicker` (reuses `/api/admin/media`, no parallel upload path) with live preview + low-resolution warning |
| `/admin/documents` console error | Not investigated before this phase | `favicon.ico` 404 (admin layout `metadata` had no `icons`) — real bug, unrelated to any browser extension; fixed |

## بند ۱ — Logo asset

No new logo FILE was created. The maintainer has not supplied a source vector/
raster logo file to this session, and **fabricating a "clean vector" by tracing
a JPEG mockup and presenting it as the real brand logo would be a false claim
this project's own rules explicitly forbid** ("ادعای وکتور روی رستر" —
forbidden in the attestation table). What was actually needed — a way for the
maintainer to supply and change their real logo without a code change — already
existed at the data layer (`company_logo_url` in `site_settings`) and now has a
real upload UI (بند ۵). The maintainer uploads their real logo file through
`/admin/company` whenever they have it; nothing here blocks that.

## بند ۲/۳/۶ — Design tokens, shared component, unification

The diagonal-header HBZ letterhead design, its color/typography/grid tokens,
and the single shared rendering function were **already built** in the prior
session (see `docs/governance/` commit history around the "unified HBZ
letterhead design" change) — reused here, not rebuilt, per the project's
already-exists exception. The one real gap this audit found (بند ۰) — the
portal print route running a second, independent template — is now closed by
routing it through the same `renderDocumentHtml`.

## بند ۴ — Language/numeral/date leaks: root cause + fix

Root cause (one shared cause across every leak in the reported screenshot):
the Invoice Designer's live-preview endpoint built its demo `DocModel` with
hardcoded English strings and never varied it by the template being
previewed. A second, independent cause existed in real document creation
(`documentData.ts`) for the buyer's legal-identity labels. A third,
engine-level cause (`money()`/date fields never digit/calendar-converted)
would have kept leaking on EVERY current and future render path even after
the first two were patched — fixed at that shared root instead
(`fmtNum`/`fmtMoney`/`fmtDate` inside `renderDocumentHtml`).

**Verified against a real, running production build + real Postgres** (not
just unit tests):
- POST `/api/admin/erp/documents/render` with the seeded `hbz-letterhead-fa`
  config → response HTML grepped for `INVOICE|Reference|Enterprise
  infrastructure service|Managed security|DESIGN-PREVIEW` → **none found**.
- Same response grepped for Latin-digit money patterns (`3,702`, `1,234`) →
  **none found** — all fa-IR (`۲,۶۱۶ ریال` etc.).
- Same response grepped for a Gregorian date (`2026-08-22` or any
  `YYYY-MM-DD`) → **none found** — Jalali (`۱۴۰۵/۰۵/۳۱`) instead.
- The English variant (`rtl:false`) still correctly shows `INVOICE`,
  `Reference`, `2026` (regression check — the fix is locale-conditional, not
  a global search-replace).
- Screenshot captured via headless Chromium against the live response — the
  same preview screen from the reported bug, now fully Persian.

16 unit tests added/passing in `src/lib/erp/__tests__/documents.test.ts`
covering fa-IR digits, Jalali conversion, Latin-preserved document numbers,
and the legacy-document title-swap defense (a document title stored as
"INVOICE" before this fix still shows "فاکتور" when re-rendered against an
rtl template).

## بند ۵ — Invoice logo in Company Profile settings

`src/app/admin/company/CompanyProfile.tsx`: the 4 branding-media fields
(logo/letterhead/seal/signature) are now `MediaPicker` widgets — browse the
existing Media Library or drag-and-drop upload, both going through the
existing `/api/admin/media` endpoint (no parallel upload path), with a live
thumbnail preview before saving. The logo/letterhead fields additionally
decode the actual image client-side and warn (with the real measured pixel
width) if it's below a print-quality threshold.

**Fallback when empty:** the header prints the company's text NAME instead of
a logo image (already implemented in `renderDocumentHtml`, unchanged by this
phase) — not a bundled default logo file, because none exists (بند ۱).
**No rebuild/deploy needed:** `loadCompanyProfile()` reads `site_settings`
live on every render.

## بند ۷ — Browser console error

Real, reproduced with Playwright against `/admin/documents` on a live build:
a `favicon.ico` 404. **Not a browser extension** — the admin root layout's
`metadata` object never declared an `icons` field, so the browser fell back
to its implicit `/favicon.ico` request, which doesn't exist (the file that
does exist, `public/favicon.svg`, was only wired into the public site's
layout). Fixed in `src/app/admin/layout.tsx`; re-verified after rebuild —
zero console errors on the same page.

## Mandatory attestation table

| بند | وضعیت | شاهد | توضیح |
|---|---|---|---|
| ۰ audit | انجام شد | این جدول + جستجوی کامل مخزن | DOC-BRAND-1 هرگز وجود نداشت؛ نشت زبانی و مسیر دوم رندر (پورتال) پیدا شد |
| ۱ لوگو | deferred — منتظر فایل واقعی | — | ساخت لوگوی وکتور از یک عکس Mockup «ادعای وکتور روی رستر» است — ممنوع طبق قاعدهٔ خودِ این فاز؛ به‌جایش مسیر آپلود واقعی ساخته شد (بند ۵) |
| ۲ توکن‌ها | از قبل موجود | commit قبلی همین جلسه | طراحی هدر مورب/رنگ/گرید در فاز قبلی ساخته شده بود |
| ۳ letterhead مشترک | از قبل موجود + یکپارچه‌سازی مسیر جامانده | `renderDocumentHtml` + رفع بند ۶ | موتور مشترک از قبل بود؛ مسیر پورتال جدا بود، یکپارچه شد |
| ۴ نشت زبان/رقم/تاریخ | انجام شد | خروجی واقعی سرور زنده (grep) + اسکرین‌شات + ۱۶ تست واحد | ریشهٔ مشترک: دادهٔ پیش‌نمایش + برچسب‌های هویت خریدار + فرمت عدد/تاریخ موتور |
| ۵ لوگو در تنظیمات | انجام شد | `CompanyProfile.tsx` + بررسی دستی | آپلود واقعی با پیش‌نمایش و هشدار رزولوشن؛ بدون مسیر آپلود موازی |
| ۶ یکپارچه‌سازی | انجام شد | رفع مسیر پورتال | تنها مسیر جدا (پورتال) روی موتور مشترک سوار شد |
| ۷ خطای مرورگر | انجام شد | Playwright واقعی، قبل/بعد | favicon.ico 404 واقعی بود، نه افزونهٔ مرورگر؛ رفع شد |

## Gates

tsc 0 · ESLint 0 · vitest 1286/1286 · build clean · 9/9 governance audits
clean · verified against a real running production build + real Postgres
(not mocked).
