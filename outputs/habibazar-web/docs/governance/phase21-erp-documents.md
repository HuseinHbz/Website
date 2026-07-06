# Phase 21.5 ERP — Module 8: Document Generation Engine (completed)

Eighth complete ERP module. One engine that generates every business document to
a clean, print-ready output with QR verification. Real, verified.

## Design note — no heavy PDF dependency

Documents render to **self-contained print-ready HTML**; the browser's native
"Save as PDF" produces the PDF. This is a legitimate, dependency-light approach
(no puppeteer/Chromium at runtime, no `pdfkit`). QR codes use the existing
`qrcode` dependency. Nothing faked, nothing heavy added.

## Shipped & verified

- **Pure engine** (`src/lib/erp/documents.ts`, 7 unit tests): 10 document types,
  `buildSalesPayload` (line qty×price → discount → tax → totals), `escapeHtml` +
  `money`, and `renderDocumentHtml` — a complete styled HTML page (header, parties,
  meta, body, line-item table, totals, QR + verify code, signature block, a
  print button, `@media print` CSS). **All interpolated text is HTML-escaped**
  (XSS-safe), verified by test.
- **Data model** (PostgreSQL): `gen_documents` (type, unique number, title,
  party, date, payload JSON, source ref, unique `verify_code`, issued/void).
- **Server layer** (`src/lib/erp/documentData.ts`): `createDocument` builds a doc
  either from a **live sales source** (pulls the sales document's lines + customer
  and runs `buildSalesPayload`) or a **manual composition** (title/party/body/
  lines); `renderDocument` loads it, generates the QR data-URL (`qrcode`) and
  returns the HTML; `verifyDocument` backs public verification.
- **APIs**: `/api/admin/erp/documents` (catalog list, generate, void) and
  `/documents/render?id=` (returns `text/html` — opened in a new tab to print /
  save PDF). zod-validated, RBAC-gated, audit-logged.
- **Public verification**: `/[locale]/verify/[code]` — the QR on every document
  points here; it confirms the document exists and is issued (or reports
  invalid/voided). Bilingual, no auth.
- **UI** (`/admin/documents`, `DocumentCenter`, fully bilingual FA/EN): a palette
  of the 10 document types, a generate dialog (from a sales invoice/quotation or a
  manual composition with a line-item editor), and the generated-document catalog
  with Print/PDF and Void.

**Verified:** tsc 0 · ESLint 0 · vitest 143/143 (7 documents) · 6 governance
audits pass · build OK · **real PostgreSQL round-trip** — an invoice generated
(total **$981** from 5×$200 −10% +9%), rendered to valid HTML with the untrusted
party/line text **HTML-escaped** (`Acme &lt;Co&gt;`, raw `<Co>` absent), a real
**QR data-URL embedded**, and **verify-by-code → INV-T1 / issued**.

## Remaining ERP roadmap

Purchasing, visual Workflow Designer, Business Rules Engine, Integration Hub,
Reporting Platform, Global Search — each built the same way, one complete module
at a time.
