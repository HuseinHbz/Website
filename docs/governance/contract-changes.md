# Contract Changes Log

Any edit to a **regression test's assertion** must be recorded here (26.26b بند ۱.۱).
A regression suite is a guardian of a behavioural contract; silently changing what it
asserts removes the guardian. Each entry states exactly what the old assertion
guaranteed, what the new one guarantees, why, and who approved it.

---

## CC-001 · 26.25s inbound-lead regression — "auto-lead" → "quarantine"
- **Date:** 2026-07-15 · **Phase:** 26.25b (بند ۰.۶) · **Suite:** `scripts/verify-2625s.ts`
- **Old assertion (15/15):** an anonymous inbound WhatsApp/Telegram message
  **immediately created a CRM lead** (`autoLeadFromInbound(...).leadId` defined),
  and that lead entered the funnel + CAC attribution directly.
- **New assertion (16/16):** an anonymous inbound message is **quarantined**
  (`crm_inbound_messages`, `status='pending_review'`, `.quarantinedId` defined,
  `.leadId` undefined); it only becomes a lead after `confirmInbound()`.
- **What the old version guaranteed that the new one no longer does:** that inbound
  traffic produces a lead with **zero human action**. That guarantee was the bug —
  it let a rotating-sender flood mint unbounded fake leads and poison CAC. It is
  deliberately gone; the new contract is "inbound is triaged before it counts."
- **Reason:** 26.25b بند ۰.۶ hardening (flood cap + quarantine). Intentional
  behaviour change, not a test hack.
- **Approved by:** maintainer prompt 26.25b بند ۰.۶ (explicitly requested quarantine).

## CC-002 · 26.26 nav ownership regression — "resolves to itself" → "membership"
- **Date:** 2026-07-15 · **Phase:** 26.26 (BUG-010) · **Suite:**
  `src/lib/admin/__tests__/workspaces.test.ts` (`workspaceForPath` table test)
- **Old assertion (draft):** every registry item's path resolves to **exactly the
  workspace that lists it**.
- **Why it was changed:** it was factually impossible — 17 pages are **cross-listed**
  in multiple workspaces (e.g. `/admin/reports` in both analytics + erp), so a
  single path cannot resolve to two workspaces. The draft assertion was wrong, not
  the code.
- **New assertion:** `workspaceForPath(path)` returns a workspace that **contains**
  the path (membership) — never the executive fallback for a registered page.
- **26.26b follow-up (بند ۲.۲):** the STRONG assertion is **restored for
  single-owner (non-cross-listed) items** — those must resolve to exactly their
  workspace; cross-listed items use the new **context-aware** assertion (stay in
  the current workspace). See `workspaces.test.ts` "strong assertion" +
  "context-aware" cases.
- **Reason:** correctness (cross-listing is a real, intended feature) + 26.26b
  context-aware fix for the second BUG-010 root.
- **Approved by:** maintainer prompt 26.26b بند ۲.۱/۲.۲.

## CC-003 · 26.26b BUG-020 reversal semantics — "original goes void" → "original stays posted"
- **Date:** 2026-07-16 · **Phase:** 26.26b (بند ۵ CFO hunt) · **Suite:**
  `scripts/verify-2623.ts` (check 14, "two-way linkage")
- **Old assertion:** after `reverseEntry`, the ORIGINAL entry has `status='void'`.
- **New assertion:** after `reverseEntry`, the original entry **stays `status='posted'`**
  and is marked reversed only via `reversed_by` (two-way link intact).
- **Why it was changed (the code was the bug):** with the original set to `void`,
  balance sums (which count `status='posted'` only) EXCLUDED it while the reversal
  entry was still posted — so every account netted to **−original** instead of 0.
  Numeric proof: posting Dr 1010 100 then reversing left account 1010 at **−100**
  (should be 0). The old assertion codified that bug (and check 15 even worked
  around it with `status IN ('posted','void')`). Standard accounting: a reversing
  entry keeps the original posted; the two balanced entries net to zero with a full
  audit trail. Fix in `glPosting.reverseEntry` (drop the `status='void'` update).
- **What the old version guaranteed that the new one no longer does:** that a
  reversed entry is excluded from posted-balance sums. That guarantee was the
  defect — it silently corrupted every account touched by a void.
- **Reason:** 26.26b بند ۵ CFO financial-integrity hunt (BUG-020), confirmed with a
  live-PG isolated reversal (1010: 100 → 0 after fix; was 100 → −100).
- **Approved by:** maintainer prompt 26.26b بند ۵ (fix real financial bugs found;
  no-fake / fix-don't-defer). Contained blast radius: one production caller
  (`voidPurchaseInvoice`) + the journal-void path; TB stays balanced; verify-2624b
  13/13 and verify-2626 unaffected.

---

**Rule (CLAUDE.md):** never change a regression assertion without an entry here.

## CC-004 — load-test login stage: storm-under-bypass → limiter-budgeted samples (INFRA-1)
- **Old assertion behavior:** the login stage benchmarked at concurrency 2 for the
  full duration, assuming `RATE_LIMIT_DISABLED=1` was honored by the server; any
  non-2xx (including the 429s that assumption produced) failed the run.
- **New assertion behavior:** login is benchmarked as 7 sequential samples inside
  the 10/15min login-limiter budget (+1 for the auth helper); any non-2xx still
  fails the run. A thrown client-side fetch (no HTTP response) is retried once
  before counting.
- **What is no longer guaranteed:** login throughput (req/s) under storm — that
  number was never real anyway: since 26.25b the server hard-ignores the bypass in
  production, so the storm path measured only the limiter (15,627×429 in CI).
  Latency percentiles (p50/p95/p99) are still measured and asserted 2xx-only.
- **Reason:** 26.25b's production hard-gate made the 26.25 storm design
  unsatisfiable on `next start` (always production). CI was red on this since.
- **Approver:** maintainer (via INFRA-1 "CI must be green" gate); recorded per rule 5.

## CC-005 — 26.29 بند ۲: menu reorganisation changes workspace-count and key assertions

- **Files:** `src/lib/admin/__tests__/workspaces.test.ts`, `src/lib/rbac/__tests__/abac.test.ts`
- **Old assertions:**
  - `expect(WORKSPACES).toHaveLength(12)`
  - `viewer sees only executive/analytics/documentation` → `['analytics','documentation','executive']`
  - context-aware test asserted `/admin/dashboard` resolves to `analytics` when the
    user is "in" Analytics, and `/admin/reports` likewise (both were CROSS-LISTED).
  - `SCOPED_MODULES` contains `crm.crm.tickets`
- **New assertions:**
  - `expect(WORKSPACES).toHaveLength(9)` (content + documentation merged into brand,
    analytics merged into executive — no module deleted, only re-homed)
  - `viewer sees only the executive + brand workspaces` → `['brand','executive']`
  - context-aware test now asserts the same guarantee on paths that still have a
    single owner: context never moves a user out of a workspace that owns the path.
  - `SCOPED_MODULES` contains `operations.crm.tickets`
- **What is no longer guaranteed:** nothing about cross-listed pages — because after
  بند ۲.۵ there are no cross-listed pages left (0 duplicate hrefs, enforced by a NEW
  test: "every menu item is unique"). The BUG-010/BUG-011 guarantees themselves are
  unchanged and still asserted (`workspaceForPath` membership + the strong
  per-item resolution test), plus a new "no duplicate Persian label" test (بند ۳).
- **Reason:** the maintainer asked for the duplicated menu entries to be merged
  ("هیچ چیزی حذف نشود فقط ادغام"). Stored RBAC grants were migrated to the new keys
  and proven intact by `scripts/verify-2629-navkeys.ts` (36/36, regression suite 14).
- **Approver:** maintainer (phase 26.29 spec, بند ۲); recorded per rule 5.

---

## CC-006 — workspace count 9 → 10 (phase 28.1)

- **Tests (two places, same contract):**
  - `src/lib/admin/__tests__/workspaces.test.ts` → "has 9 workspaces with unique ids"
  - `scripts/verify-2629-navkeys.ts` → assertion 19, "workspace count is 9 (was 12)"
    (regression suite 14)
- **Old assertion:** `WORKSPACES.length === 9` / `wsCount === 9`
- **New assertion:** `WORKSPACES.length === 10` / `wsCount === 10`
- **What is no longer guaranteed:** the count itself is not a behavioural guarantee —
  it is a tripwire against workspace proliferation (a module quietly acquiring a
  second home, which CC-005 was written to stop). Raising it by exactly one, for one
  named workspace, keeps that tripwire armed. Every invariant CC-005 actually
  protects is untouched and still asserted: zero duplicate hrefs, no two modules
  sharing a Persian label, and one-module-one-menu-item.
- **Reason:** phase 28 adds Human Resources. It was first placed inside the CRM
  workspace, which derived the permission key `crm.hr.employees` — wrong on its own
  terms (HR is not CRM) and wrong against the phase spec, which names the keys
  `hr.employees` / `hr.leave` / `hr.attendance` / `hr.payroll`. HR also holds the
  most sensitive data in the system (salary, national id, bank details) and needs
  permission keys that can be granted independently of CRM.
  No RBAC key migration was required: the workspace and its module are new, so no
  stored grant referenced the old key (`audit:rbac` 162 guarded · 0 failures).
- **Approver:** maintainer (phase 28 spec, `cross_cutting.rbac` names these keys);
  recorded per rule 5.

## CC-007 · 26.24b closeout regression — "AP negative then corrected" → "payment blocked pre-confirm"
- **Date:** 2026-08-29 · **Phase:** 4 (Procurement/Purchase-to-Pay hardening) ·
  **Suite:** `scripts/verify-2624b.ts` (بند ۱ BUG-008 AP proof, tests #1 and #7)
- **Old assertion:** paying a purchase invoice that was never posted to the GL
  **succeeds and drives AP negative** (the bug being demonstrated); later
  confirming that same invoice books it and brings **global AP back to exactly
  zero without ever recording a second payment**.
- **New assertion:** `recordPayment` now refuses a payment against a
  draft/unconfirmed purchase invoice outright (`ok:false`, reusing
  `sales.ts`'s `validatePayment`) — AP is **provably unchanged**, not merely
  corrected afterwards. The stranded invoice is confirmed and THEN paid (now
  that it is no longer draft), and global AP still settles to exactly zero.
- **What the old version guaranteed that the new one no longer does:** that a
  payment could be recorded against an unconfirmed purchase invoice at all.
  That was the real, unguarded defect Phase 4's procurement audit found —
  purchasing had zero overpayment/status guard on `recordPayment`, unlike the
  sales side. Blocking the payment outright is a strictly stronger fix than
  "let it happen, then reconcile."
- **Reason:** Phase 4 procurement hardening — `recordPayment` gained the same
  status/overpayment guard the sales payment path already had, reusing the
  existing pure `validatePayment` (no duplicated validation logic).
- **Approved by:** Phase 4 procurement master-prompt scope (Section 8: "Look
  specifically for TOCTOU patterns similar to the Sales payment bug... treat
  as a real concurrency defect").

## CC-008 · 26.23 regression — postEntryById on an already-posted entry: "error" → "idempotent success"
- **Date:** 2026-08-30 · **Phase:** 7 (Finance/AR/AP/GL hardening) ·
  **Suite:** `scripts/verify-2623.ts` (بند ۴ maker/checker section)
- **Old assertion:** calling `postEntryById` on an entry that is already
  `posted` returns `{ok:false, error:'Only draft entries can be posted'}`.
- **New assertion:** the same call now returns `{ok:true, alreadyPosted:true}`
  — a genuinely idempotent no-op, not an error.
- **What the old version guaranteed that the new one no longer does:** that
  re-posting an already-posted entry was treated as a caller mistake. That
  was too strict for the real failure mode this phase closed: `postEntryById`
  previously did a bare, unlocked read-then-write, so two genuinely
  concurrent "post" calls on the same draft could both pass the
  `status==='draft'` check before either committed. The fix wraps the whole
  check+write in one transaction locked per entry id — the SECOND concurrent
  caller now correctly blocks on the lock, then re-reads the (now-posted)
  status. Returning it as an error would misreport a legitimate concurrent
  duplicate as a failure; returning idempotent success matches the master
  remediation program's own requirement that a retry after a successful
  POST report the same logical (successful) result.
- **Reason:** Phase 7 finance-hardening master prompt, Section 2 ("retry
  after successful POST") and Section 3 ("5 concurrent identical posting
  requests... exactly 1 financial event") — an idempotent no-op is the
  correct externally-observable behavior for a duplicate/concurrent post,
  not an error.
- **Approved by:** Phase 7 master-prompt scope (explicit idempotency
  requirement); the callers that need "reject a non-draft post" as a hard
  error (the journal route's PUT handler) keep their own separate,
  unaffected `e.status !== 'draft'` pre-check for a genuinely *manual*
  re-post attempt by a user who can see the entry is already posted —
  only the internal race between two concurrent calls is now idempotent.

## CC-009 · ERPFIX-1 BUG-ERP-10 — payroll expense assertions: 6100 → 6000
- **Date:** 2026-10-16 · **Phase:** ERPFIX-1 · **Suites:** `scripts/verify-28-3-payroll.ts`
  (checks «payroll expense is debited with the gross» + «posting twice does NOT double
  the payroll expense»), `src/lib/hr/__tests__/payroll.test.ts` («debits the gross as
  expense …»)
- **Old assertion:** the payroll gross lands on account **6100**.
- **New assertion:** the payroll gross lands on account **6000** «Salaries Expense»;
  the unit test additionally asserts **no** line targets 6100.
- **What the old version guaranteed that the new one no longer does:** that salaries
  post to 6100. That guarantee WAS the bug: 6100 is seeded as «Rent Expense»
  (`migrate.ts`), and a later `INSERT … ('6100','Salaries') ON CONFLICT DO NOTHING`
  was a silent no-op, so every payroll run was reported as RENT on the income
  statement (reproduced live: 352,000,000 under «Rent Expense», 0 under «Salaries
  Expense»). The balances asserted (gross, 2300/2310/2320) are unchanged.
- **Reason:** BUG-ERP-10. **Approved by:** maintainer, ERPFIX-1 decision gate
  (answered "6000 (Recommended)" in-session, 2026-10-16).

## CC-010 · ERPFIX-1 BUG-ERP-08 — strict fiscal periods (behaviour change + fixture setting)
- **Date:** 2026-10-16 · **Phase:** ERPFIX-1 · **Behaviour:** `assertPostable` /
  `canPostDate` / `insertPostedEntry`
- **Old behaviour:** a date inside NO defined fiscal period was always postable.
- **New behaviour:** `erp_settings.gl_require_period` (seeded **'strict'**): once at
  least one fiscal period exists, a date outside every period is refused with
  `ERP-FINANCE-DATE-OUTSIDE-PERIODS`. A fresh install with no period at all still
  posts. `'off'` restores the old rule. A malformed date (`'abc'`, `'2025-02-30'`) is
  now refused (`ERP-FINANCE-INVALID-DATE`) — it used to fall through as "in no
  period" and was accepted.
- **Fixtures (no assertion edited):** five suites define ONE closed period (e.g.
  2018) and then post at other dates — `verify-2626b-cfo.ts`, `verify-phase8-finance.ts`,
  `verify-phase11-…`, `verify-phase12-…`, `verify-phase17-financial-controls.ts`. Each
  now sets `gl_require_period='off'` right after seeding, with a comment. What they
  assert (closed-period rejection) is unaffected by the setting.
- **What is no longer guaranteed:** that an operator who defined periods for one year
  can keep posting into an undefined year without defining it. **Operator action on
  upgrade:** if production has periods defined but not for the current year, define
  the current year (Finance → Accounting) or set `gl_require_period` to `off`.
- **Reason:** BUG-ERP-08. **Approved by:** ERPFIX-1 prompt (required_changes, item 4).

## CC-011 · ERPFIX-1 — year-end closing / opening balance and the period gate
- **Date:** 2026-10-16 · **Phase:** ERPFIX-1
- **Old behaviour:** `runYearEndClosing` ignored the period gate entirely (it posted
  into a LOCKED year — reproduced live) and de-duplicated with `memo LIKE '%name%'`
  (closing «2025» blocked closing «25»; 5 concurrent runs booked 2 entries with the
  SAME number `YEC-2027-1945`). `postOpeningBalance` refused a closed period.
- **New behaviour:** both post through `insertPostedEntry` with an explicit
  `allowClosedPeriod` — a CLOSED period is allowed, a LOCKED one never. Closing is
  idempotent on `reference='year-end-close:<fiscal_period_id>'` (advisory lock + a
  partial unique index), scoped to one company. Both route actions now require
  `requireOp('erp.finance:close_period')`; a refused closing is audit-logged. An
  already-closed year returns `ERP-FINANCE-YEAR-ALREADY-CLOSED` (bilingual).
- **What is no longer guaranteed:** that a non-holder of `erp.finance:close_period`
  (but with `manage_settings`) can post an opening balance; that a closing entry
  dated in a locked year can be booked.
- **sim-2621 helper:** its `bookEntry` data-prep helper wrote the header and each
  line as separate auto-committed statements, which the new deferred balance trigger
  correctly rejects; it now posts through `insertPostedEntry`, and its monthly payroll
  accrual uses 6000. No assertion changed.
- **Reason:** BUG-ERP-08 / BUG-ERP-21. **Approved by:** ERPFIX-1 prompt.

## CC-012 · ERPFIX-1 — numbering of posted entries is minted inside the posting transaction
- **Date:** 2026-10-16 · **Phase:** ERPFIX-1
- **Old behaviour:** `nextNumber` minted on a second pool connection. Inside a
  posting transaction (which already holds a connection) the pool starved under
  load: in the ERPFIX-1 proof, 20 concurrent postings → 10 `numbering.fallback`
  timeouts → `Date.now()` numbers, and 7 postings failed.
- **New behaviour:** `insertPostedEntry` mints via `nextNumberInTx` on the caller's
  connection. A rolled-back posting now rolls its number back (no gap); same-type
  postings serialise on the counter's advisory lock until commit. System entries
  (opening / year-end / intercompany / FX revaluation) use their own formats
  `OB-/YEC-/IC-/FXR-{YEAR}-{COUNTER}` instead of a `Date.now()` suffix.
- **Also:** an opening-balance IMPORT run as a **dry run** used to really post the
  entry (it ran before `BEGIN`, on its own connection); it now runs inside the job's
  transaction and is rolled back with it.
- **Reason:** BUG-ERP-21. **Approved by:** ERPFIX-1 prompt.

## CC-013 · ERPFIX-2 BUG-ERP-03 — GL lines are in BASE currency (structural behaviour change)
- **Date:** 2026-10-16 · **Phase:** ERPFIX-2 · **No existing regression assertion was edited.**
- **Old behaviour:** a foreign-currency document posted its raw transaction-currency
  amounts as GL debits/credits (100 USD → AR 100), under a header that named the
  currency; payment posters wrote an IRR / rate-1 header over raw USD lines. Every
  account mixed USD, EUR, IRT and IRR while the trial balance still "balanced".
- **New behaviour:** every line is converted by `src/lib/erp/money.ts` (`toBase` /
  `linesToBase`) at the document's booked rate — conversions rounded to
  `erp_settings.decimal_precision` (default 0), the rounding residue on the AR/AP
  line so the entry balances exactly; the foreign amount is kept on the line
  (`gl_journal_lines.fx_amount` / `fx_currency`). A settlement posts the bank at the
  payment-day rate, the control account at the booked rate (proportional to the
  share settled), and the difference to realized FX gain 4900 / loss 6980.
  Treasury posts its cash entry at the payment rate and a separate FX true-up
  entry (`TRZPAY-FX-<id>`, `TRZRCP-FX-<id>`, `AP-/AR-CONSUME-FX:<src>`), reversed
  together with the payment. `reverseEntry` now carries the original's currency,
  rate, company, cost centers and foreign amounts.
- **What is no longer guaranteed:** that a GL line amount equals the document's own
  `total` for a non-IRR document (it equals `base`), and that a reversal is booked
  in the default company / IRR regardless of the original.
- **Reason:** BUG-ERP-03. **Approved by:** ERPFIX-2 prompt.

## CC-014 · ERPFIX-2 — payments, thresholds and allocation on base / same currency
- **Date:** 2026-10-16 · **Phase:** ERPFIX-2
- **Payments:** a payment applied to a document is stored in the DOCUMENT's
  currency. Omitting `currency` now means "the invoice's currency" (was IRR); a
  different currency is refused (`ERP-FINANCE-PAYMENT-CURRENCY-MISMATCH`) unless an
  explicit `conversionRate` is given. The rate is the one dated on/before the
  payment date (`rialRateOn`) or an explicit `exchangeRate` — it used to be the
  latest rate regardless of date, or silently 1 when none existed; now a missing
  rate is refused (`ERP-FINANCE-NO-EXCHANGE-RATE`). Same rule for a purchase
  document in a currency with no rate (it was booked at rate 1).
- **Thresholds:** purchase approval tiers, department budget, customer credit limit
  and the Treasury payment approval matrix compare the BASE amount (`base_total`,
  or `total × exchange_rate` for legacy rows with `base_total = 0`). 1,000 USD now
  needs the 3-level approval a 600,000,000-Rial document needs (was 1 level).
- **Customer 360:** balance and aging are in base currency (`outstandingForeign`
  keeps the invoice-currency figure).
- **Allocation:** Treasury supplier payments / customer receipts and the Phase 12 /
  Phase 17 unapplied-cash consumption allocate only to documents in the SAME
  currency (they used to compare a USD amount against an IRR balance). For IRR-only
  data nothing changes.
- **What is no longer guaranteed:** that an IRR Treasury payment is allocated
  against a foreign-currency invoice; that a foreign document can be created
  without a configured rate.
- **Reason:** BUG-ERP-03. **Approved by:** ERPFIX-2 prompt.
