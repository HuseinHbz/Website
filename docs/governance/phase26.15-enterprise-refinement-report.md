# Phase 26.15 — Enterprise Refinement & Perfection Pass (Audit + Fixes)

A **refinement** phase, not a rewrite. Per the mandate (*Audit First · Reuse First
· Then Improve · Execute ONLY real gaps · No rebuild · No regression*), this pass
audits the whole ERP against SAP B1 / D365 / NetSuite / Odoo-class expectations,
confirms what already ships from Phases 26.0–26.14 (reused, not rebuilt), and
fixes the **genuine** remaining gaps with live-PG verification.

## 1. Workflow & Feature Audit — already shipped (reuse, no rebuild)

The 20 requested modules map almost entirely onto existing, verified work:

| Requested | Status | Where (reused) |
|---|---|---|
| M3 Visual Workflow Designer | ✅ exists | `WorkflowCanvas` (drag/drop nodes, edges, property panel, Canvas/JSON toggle, 26.10) + node types parallel/notification/ai_decision (26.12) |
| M4 Visual Rule Builder | ✅ exists | `RuleBuilder` visual conditions/outputs replacing raw JSON (26.10-E) |
| M5 Financial reports | ✅ exists | trial balance / income / balance sheet / GL / account statement, bilingual labels (26.10-C), CSV/Excel export |
| M6 Word-like Document editor | ✅ exists | `RichTextEditor` (contentEditable + toolbar + sanitizer, 26.10-F) |
| M7 Iran letterheads/templates | ✅ exists | 20 Persian `fa-*` templates + `fa-contract`/`fa-letterhead` + 24 invoice templates (26.7/26.10) |
| M8 Sales lifecycle | ✅ exists | Sales Center (draft→sent→confirmed→partial→paid→void, credit/debit note, statement, 26.4/26.9) |
| M9 Purchasing lifecycle | ✅ exists | PR→RFQ→compare→PO→GRN(partial)→invoice→payment→return, supplier statement (26.1) |
| M10 Inventory | ✅ exists | warehouses, opening stock, FIFO/LIFO/WAVG valuation, moves (26.10-D) |
| M12/M13 Supplier/Customer mgmt | ✅ exists | full profiles + legal identity + credit + statements (26.2/26.9) |
| M14 Localization | ✅ exists | bilingual FA/EN + RTL across admin + documents; `audit:i18n` = 0 |
| M15 Enterprise forms | ✅ exists | shared `ui.tsx` controls + zod validation + `crud`/`useResource` |
| M16 Dashboard UX | ✅ exists | currency-aware KPI cards + `CurrencyPicker` + saved views (26.8) |
| M17 Consistency | ✅ gated | `audit:tokens` (colour) + `audit:ui` (type scale) = 0; shared DataTable |
| M18 Performance | ✅ mostly | virtualized DataTable, code-split recharts, debounced search |
| M19 Accessibility | ✅ mostly | ARIA/`aria-current`/skip-link/keyboard nav in sidebar + DataTable |
| M2 Navigation | ⚠ **gap → fixed** | see below |
| M11 Product experience | ⚠ **gap → fixed** | see below |

## 2. Real gaps found + fixed (with live-PG verification)

### Gap A — Duplicated/incorrect sidebar activation on tabbed nav (M2)
The `?tab=` nav items added in 26.11–26.14 (Financial Intelligence, Approvals,
Business Intelligence, Treasury) all share one pathname. `AdminSidebar` resolved
the active item from `usePathname()` (query stripped), so **every tab of a
workspace collapsed to the first item** — navigating to `?tab=banks` still lit
"Overview". **Fix:** `resolveActiveHref(pathname, hrefs, activeTab?)` is now
tab-aware; `AdminSidebar` reads `useSearchParams().get('tab')` and passes it, so
exactly the current tab is active. Regression test added (`navResolver.test.ts`).

### Gap B — Product picker loaded the entire catalog (M11 / M18)
The sales invoice line editor fetched **all** products (`loadProductLevels`, no
limit) into a native `<select>` — the exact "never load 1000 products at once"
anti-pattern. **Fix:** the products API gained a **server-limited** `?picker=1&q=`
branch (SKU/barcode/name ILIKE, `LIMIT 25`), and the `<select>` was replaced by a
**debounced incremental-search `ProductSearchPicker`** (250 ms, on-demand,
results capped). The full-catalog path (inventory dashboard) is untouched.
Live-PG: 60 products → search returns ≤25 filtered, empty query capped at 25,
barcode search works — never the whole catalog.

### (Carried from 26.14) Latent AR correctness fix
`openReceivables` and the treasury layer queried a **non-existent**
`sales_documents.paid_total` (silently 0 behind guards); corrected to compute AR
from `sales_payments`. Real behaviour restored, not faked.

## 3. Localization / Consistency / Performance / UX reports (summary)
- **Localization:** `audit:i18n` = 0 missing / 0 empty; every new picker string is
  bilingual. No regression.
- **Consistency:** `audit:tokens` = 0 arbitrary colours, `audit:ui` = 0 arbitrary
  font-sizes; the new picker uses only design-system tokens.
- **Performance:** product lookups are now O(query) server-limited + debounced;
  no change to bundle (`/admin/sales` unchanged), no new dependency.
- **UX/Navigation:** exactly one active nav item on every route including tabs.

## 4. Final gates (No Regression)
```
TypeScript 0 · ESLint 0 · 469 unit tests (all pass) · 7 governance audits 0
Production build: clean · Live PostgreSQL: nav resolver + product picker verified
```

## 5. Honest boundaries (what was deliberately NOT done)
This is a no-rewrite refinement, so items that would mean rebuilding a working
module or adding an audit-forbidden heavy dependency were **not** undertaken, and
are recorded honestly rather than faked:
- **DOCX export** (M6): the document engine intentionally stays print-ready
  HTML → browser "Save as PDF" (standing no-heavy-PDF/OOXML-dependency decision).
  HTML/PDF(print) exist; a real `.docx` writer would add a heavy dependency the
  `audit:deps` gate forbids.
- **Full drag-canvas zoom/pan rewrite** (M3): the existing `WorkflowCanvas`
  already does drag/drop + property editing + JSON round-trip; a pixel-zoom/pan
  rewrite is out of scope for a no-regression pass.
- The remaining M8–M13 lifecycle items were **audited and confirmed present** —
  reused, not rebuilt (per "No duplicate engines / No rebuild").

**Phase 26.15 Status: REFINEMENT PASS COMPLETE — real gaps fixed, everything
else audited & reused, zero regression.**
