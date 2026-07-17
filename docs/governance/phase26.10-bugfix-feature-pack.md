# Phase 26.10 — Bug-fix & Feature Pack (RTL Documents · Visual Rules · Inventory · Hero Orbits)

Origin: a maintainer bug report (Persian) against the live admin panel plus a
reference animation (a network/orbit constellation of tech nodes). Eight items,
executed **بند به بند** — audit-first, reusing existing architecture, never
duplicating. Everything below is verified against **real PostgreSQL**, with
`type-check 0`, `lint 0`, **396 unit tests (54 files)**, all **7 governance
audits at 0**, and a clean production build.

| # | Reported problem | Type | Resolution | Commit |
|---|---|---|---|---|
| A | Workflow save → `key: letters, digits, . _ - only` | bug | Auto-slugify the key on save + live-sanitize input | `86481cb` |
| B | Edit/Delete row menu needs scrolling (clipped) | bug | Row-action menu escapes table clip via `position: fixed` | `86481cb` |
| C | Reports Center English-only; trial balance "broken" | bug | Bilingual report labels; trial balance was correct (empty-state, not a bug) | `86481cb` |
| D | Inventory: no warehouse on product; shows ناموجود; not sellable | bug | Opening-stock on product create → real `inv_moves`; products sellable in invoices | `86481cb` |
| E | Rules defined as raw JSON — wanted a visual flow builder | feature | Visual condition/output builder over the same engine-valid JSON | `fa40ae4` |
| F | Contract not RTL; wanted a Word-like editor + Iranian letterhead | feature | Sanitized rich-HTML body + contentEditable toolbar + letterhead banner | `f917ec9` |
| G | Invoice English-only — wanted 20 ready Persian templates | feature | RTL document engine + 20 Persian (`fa-*`) templates | `7356de0` |
| H | Add 20 orbit/network hero animations + live preview | feature | 20 `orbit` presets + CSS keyframes + builder live-preview tile | `d68b308` |

---

## A — Workflow key auto-slugify (bug)

The Workflow Designer rejected saves whose key contained spaces/Persian/upper
case because the numbering-safe key validator only allows `[a-z0-9._-]`. Users
naturally typed a display name.

**Fix** (`WorkflowManager.tsx`): a `slugify()` helper normalises to the allowed
alphabet; `save()` derives the key as `slugify(key) || slugify(nameEn) ||
wf-<base36 ts>` (never empty), and the key `Input` live-sanitizes on change so
the field always shows a valid value. No API change — the server contract was
already correct; the UI now honours it.

## B — Row-action menu clipping (bug)

Every module table's row "⋯" menu was rendered inside the table's
`overflow-auto` scroll container, so on the last rows it was clipped and needed
scrolling — the reported "edit/delete needs scroll".

**Fix** (`DataTable.tsx`, the one shared Enterprise DataTable → fixes *all*
modules at once): `RowActionsMenu` now measures the trigger with
`getBoundingClientRect()` and renders the popover with `position: fixed`,
flipping up/left near viewport edges and closing on scroll/resize. It escapes
the scroll clip entirely. Because every admin table uses this one component
(Phase 22.6), Inventory's edit/delete — and CRM/Sales/Finance/… — are all fixed
by this single change.

## C — Reports Center bilingual + trial balance (bug)

Two separate reports. (1) The Reporting Center rendered **English column/summary
labels** even in Persian. (2) "تراز آزمایشی کار نمی‌کند" (trial balance doesn't
work).

**Investigation** — the trial balance was **not broken**: `trialBalance()`
(`lib/erp/ledger.ts`) filters out accounts whose debit *and* credit are both
zero, which is correct accounting. On a fresh install with no posted journal
entries the result is legitimately empty; combined with English headers this
read as "broken". A live-PG check confirmed it ties out exactly (1000 Dr / 1000
Cr) once a balanced entry is posted.

**Fix** (`ReportingCenter.tsx`): a `LABEL_FA` dictionary + `faLabel()` translate
the fixed report catalog's column and summary labels; applied to the summary
`StatCard`s and every `DataTable` column (`labelFa`). No engine change — the
numbers were always right; only the presentation was monolingual.

## D — Inventory: opening stock + sellable products (bug)

Three linked complaints: defining a product offered **no warehouse**; a new
product with stock still showed **ناموجود** (out of stock); and warehouse
products **couldn't be added to a sales invoice**.

Root cause: inventory on-hand is derived purely from the `inv_moves` ledger
(correct, event-sourced design) — but the product-create form never wrote an
opening move, so on-hand was 0 by construction.

**Fix:**
- `api/admin/erp/inventory/products/route.ts` — create schema accepts
  `openingWarehouseId` + `openingQty`; when supplied it inserts a real
  `receipt` `inv_moves` row (`ref = 'Opening stock'`), so valuation/on-hand are
  immediately correct through the same ledger everything else reads.
- `InventoryCenter.tsx` — the product modal loads warehouses and (on create)
  shows **warehouse + opening quantity** fields.
- `SalesCenter.tsx` — the sales-document line editor gained an **"Add inventory
  product"** picker (`invProducts` + `addProduct`) alongside the price-list
  picker, so stocked items drop straight onto an invoice line.
- The edit/delete-needs-scroll part of this complaint is resolved by **B**.

## E — Rules Center visual flow builder (feature)

Business rules were authored as raw engine JSON. The maintainer wanted a
graph/flow, drag-friendly builder.

**Built** — reusing the existing rules engine (no second rule format):
- `lib/rules/builder.ts` (pure, tested): `RULE_OPS_UI` (12 operators),
  `Cond`/`RuleNode` model, `parseDef(json)` (engine JSON → visual model),
  `serializeDef(model)` (model → **engine-valid** JSON, coercing values to
  number/bool/JSON and dropping the value for `truthy`/`falsy`), `coerce()`.
- `RulesCenter.tsx` — a `RuleBuilder` with a **Visual/JSON toggle**: per-rule
  id · priority · match (all/any); condition rows (field · operator · value,
  value auto-disabled for truthy/falsy); output rows (key · value); result mode
  first-match/collect. Invalid or exotic JSON gracefully falls back to the raw
  textarea (never blocks an expert). Wired into **both** the create modal and
  the version editor — replacing the two JSON textareas.
- `__tests__/ruleBuilder.test.ts` — round-trip proof that `serializeDef` output
  evaluates **identically** through `runRules` (gold→20 %, bulk→10 %, default→0;
  truthy drops value; numbers/booleans coerce).

## F — Word-like RTL contract editor + Iranian letterhead (feature)

Contract bodies rendered as escaped, direction-less pre-line text; the
maintainer wanted a Word-like editor (font/size/alignment) and a modern Iranian
letterhead with upload.

**Built:**
- **Sanitizer** `lib/erp/richtext.ts` (pure, dependency-free, **13 XSS unit
  tests**): allowlist tags (`p b i u s h1–h4 ul ol li span div blockquote` …);
  strips `script/style/iframe/object/embed/…`, all event handlers, `href/src`;
  keeps only a **re-validated** inline `style` (`text-align`, `font-size`,
  `font-weight`, `font-style`, `text-decoration`, `color`, `direction`);
  neutralises `javascript:`. Runs server-side at render — even DB-tampered HTML
  is sanitized on the way out.
- **Engine wiring** — `DocPayload.bodyHtml` + `DocBranding.letterheadUrl`:
  `renderDocumentHtml` renders sanitized rich HTML with the page direction (RTL
  for Persian templates) instead of escaping it, styles `.body.rich`
  headings/lists/blockquotes, and prints a full-width uploaded **letterhead
  banner** atop the page. `createDocument`/`CreateInput` + the POST schema carry
  `bodyHtml`.
- **Editor** — `RichTextEditor` in `DocumentCenter` (native `contentEditable` +
  toolbar: bold/italic/underline, H1–H3/paragraph, bulleted/numbered lists,
  align right/center/left/justify, font-size, RTL/LTR toggle). Emits sanitized
  HTML + a plain-text fallback; replaces the plain body textarea for manual
  composition.
- **Letterhead** — Company Profile gains `company_letterhead_url` (uploadable
  via Media Library); `fa-contract` upgraded to a real RTL contract letterhead
  (`doc_type=contract`, «بسمه تعالی» header, standard Iranian contract terms) +
  a new `fa-letterhead` official-letterhead template.

Live-PG: a contract with a rich RTL body **and an embedded XSS payload** →
generated (`CT-2026-000001`) + rendered → headings/bold/font-size/alignment/
lists survive, `<script>`/`onerror` stripped, letterhead banner + Iranian terms
printed.

## G — 20 Persian invoice templates (feature)

**Built** — RTL made a first-class document-engine capability:
- `documents.ts` — `DocTemplateConfig.rtl`; when set, the whole page renders
  `dir="rtl" lang="fa"` with a fully **localized label set** (گیرنده/جمع کل/شرح/
  تعداد/قیمت واحد/مبلغ/شرایط پرداخت/کد تأیید/چاپ …). Totals, party block, table
  headers, payment/terms, verify strip and identity all switch language.
- `documents/templates` route — config schema accepts `rtl`.
- `DocumentCenter` Invoice Designer — a «فارسی / راست‌چین» toggle.
- `migrate.ts` — **20 seeded `fa-*` templates** (official/tax/unofficial/
  proforma/service/retail/corporate/blue/green/minimal/classic/modern/gold/
  contract/vat/export/compact/elegant/industrial/clinic), each `rtl:true`, all
  still fully customizable in the designer.

## H — 20 orbit/network hero animations + live preview (feature)

From the reference constellation image — extends the existing Hero Animation
Engine (no rewrite):
- `lib/hero/animations.ts` — new `orbit` category + **20 presets** (orbit-spin/
  reverse/tilt, node-pulse/glow/ripple, constellation/-drift, radar-sweep,
  network-pulse, satellite/-fast, aurora, nebula, grid-pan/glow, signal-ping,
  sonar, galaxy-spin, vortex). Library total **75**.
- `globals.css` — 20 `@keyframes hx*` + `.hx-*` classes (reduced-motion guarded;
  JS-only presets fall back to fade).
- `HeroBuilder.tsx` — the Animations picker now shows a **looping live-preview
  tile** on a dark stage that re-mounts on any parameter change, so every
  animation is previewable when selected (the maintainer's explicit ask).
- `__tests__/animations.test.ts` — asserts the 20 orbit presets resolve to
  `hx-*` classes and the library is 75.

---

## Verification (whole phase)

```
type-check ....... 0 errors
lint ............. 0 warnings
unit tests ....... 396 passed (54 files)   ← +richtext(13) +ruleBuilder +animations
audits ........... tokens 0 · content 0 · deps clean · links 0 · i18n 0 (missing/empty) · ui 0
build ............ clean (First Load JS shared 102 kB)
live-PG .......... contract rich-HTML+letterhead+XSS round-trip; trial balance tie-out;
                   inventory opening-stock on-hand; Persian template render
```

## Honest boundaries (no fake)

- **PDF** stays print-ready HTML → browser "Save as PDF" (the standing
  no-heavy-PDF-dependency decision since Phase 21.5). The Word-like editor and
  letterhead operate on that same HTML path.
- **Rich-text editor** uses the native `document.execCommand` (dependency-free);
  outputs are always re-sanitized server-side, so the deprecated API is never a
  security surface. Font-size maps to an allowlisted `span` style; colour is
  intentionally hex-only in the sanitizer.
- **Trial balance** was never broken — the empty result on fresh data is correct
  behaviour; only the labels were monolingual (fixed).
