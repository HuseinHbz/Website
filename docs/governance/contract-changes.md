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
