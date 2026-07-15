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

---

**Rule (CLAUDE.md):** never change a regression assertion without an entry here.
