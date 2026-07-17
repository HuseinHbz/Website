# Phase 26.26b — Compliance & Closeout report

No new features. Compliance, completion, proof. This is **pass 1** of the closeout:
بند ۰ (blocker) + the concrete technical items of بند ۱/۲/۵ are done with evidence;
the large hunts (بند ۳ CFO numeric, بند ۴ QA sweep) and the real Playwright run are
scheduled for pass 2 with explicit reasons below (multi-pass is allowed; بند ۰ is
done in pass 1 as required).

## بند ۰ — branch (blocker) — raw state

```
$ git branch -a
* feature/v2-enterprise-upgrade
  claude/bold-lamport-a1d6tg
  remotes/origin/feature/v2-enterprise-upgrade
  remotes/origin/claude/bold-lamport-a1d6tg
$ git log --graph (excerpt)
* a08223e Merge pull request #6 from …/claude/bold-lamport-a1d6tg   ← 26.26 merged by maintainer
* 4cfb261 26.26 بند۱/۲ deliverables …            (63fac3d..4cfb261 = the 5 × 26.26 commits)
*   9938fe9 Merge pull request #5 …               ← 26.25b merged by maintainer
|\  (5d3c5e7..6663452 = the 5 × 26.25b commits)
* d0560ec Phase 26.25a بند۳ …
```

**Answers (بند ۰.۱):**
- **Where are the commits?** 26.25a: on `feature/v2` directly (ca77228..d0560ec).
  26.25b: committed on **local `feature/v2`**, pushed to remote side-branch
  `claude/bold-lamport-a1d6tg`, then merged into remote `feature/v2` by the
  **maintainer via PR #5** (9938fe9). 26.26: same pattern → merged via **PR #6**
  (a08223e).
- **`feature/v2` latest commit:** `a08223e` (PR #6 merge). It is **not behind** — it
  contains everything. Local was fast-forwarded to it (`git merge --ff-only`).
- **What did force-push rewrite?** Only the **remote side-branch
  `claude/bold-lamport-a1d6tg`** — twice: (a) `--reset-author` to fix committer
  identity flagged by the stop-hook, (b) a `git rebase origin/feature/v2` that
  dropped the 5 already-merged 26.25b duplicate commits (identical patch-ids) and
  kept the 5 × 26.26 commits. **`feature/v2-enterprise-upgrade` was NEVER
  force-pushed by me** (its reflog shows only local rebases + the maintainer's PR
  merges).
- **Anything lost?** No. `git merge-base --is-ancestor` confirms all five 26.25b
  commits (5d3c5e7,a5d43b3,92946fc,b451e2b,6663452) are reachable from the
  `feature/v2` tip; the maintainer's PR#5/PR#6 merges are intact.

**بند ۰.۲ — work on the right branch:** already achieved — 26.25b (PR#5) and 26.26
(PR#6) are both on `feature/v2-enterprise-upgrade` via the maintainer's own merges.
Local is fast-forwarded to `a08223e` (no force, no rewrite). Method = rely on the
existing PR merges + FF sync (nothing to cherry-pick). Side-branch
`claude/bold-lamport-a1d6tg`: **kept** (not deleted); its disposition is left to the
maintainer.

**بند ۰.۳ — why did the branch change (root cause):** the session's harness-level
**"Git Development Branch Requirements"** explicitly instruct: *"Develop on branch
`claude/bold-lamport-a1d6tg`"* and *"NEVER push to a different branch without
explicit permission."* The remote-execution environment pushes to that side branch
and opens a PR into the base. That is a **real environment constraint**, not a free
choice — it conflicts with CLAUDE.md's `feature/v2` rule. Per بند ۰.۳ this is now
**surfaced explicitly** and CLAUDE.md rule 5 updated: such a constraint must be
surfaced + asked about, never silently worked around. This phase's new work is
pushed to `feature/v2` per your explicit instruction ("push به feature/v2 — بدون
force"); a plain fast-forward, no force.

## بند ۱ — the four items
- **1.1 (contract change 26.25s):** logged as **CC-001** in
  `docs/governance/contract-changes.md`. Old guarantee: inbound→lead with zero human
  action. That guarantee was the bug; now inbound is quarantined until confirmed.
  CLAUDE.md rule added: regression-assertion edits must be logged there.
- **1.2 (Playwright): honest answer — it has NEVER been executed.** It was written in
  26.25b (`e2e/portal.spec.ts`) and only type-checked. Reason it cannot run in this
  chat turn: it needs a built app + `next start` on a live port + a seeded Postgres +
  a Chromium browser session — a multi-minute, stateful setup. **Plan (pass 2 /
  CI):** a dedicated CI job — build → `next start` + postgres service →
  `npx playwright test e2e/portal.spec.ts` (Chromium at `/opt/pw-browsers`), with the
  raw output (count/pass-fail/duration) captured. **Status: DEFERRED to pass 2** —
  the RUN, not the question, is deferred; the question is answered.
- **1.3 (i18n baseline):** LOCKED at **28** in `scripts/i18n-baseline.json`.
  `audit:i18n` now **fails** if the hardcoded-Persian count exceeds the baseline
  (`hardcodedRegressed` → exit 1); reductions are encouraged (lower the number). The
  28 files are listed in the baseline file. (It was 39 in 26.26; the BUG-012
  DatabaseHealth bilingual rewrite removed 11.)
- **1.4 (two questions):**
  - **scrypt params — YES, stored + self-describing.** Format:
    `scrypt$N$r$p$saltHex$hashHex` (e.g. `scrypt$32768$8$1$<salt>$<hash>`).
    `verifyPassword` parses N/r/p **from the stored string** and uses them, so
    changing the module defaults never breaks existing hashes. **Test proof
    (new):** `password.test.ts` "is self-describing" hashes with N=16384 and N=8192
    (≠ default 32768) and both verify. Legacy bcrypt hashes also verify + rehash.
  - **onboarding links — YES.** All 10 checklist items in `lib/admin/onboarding.ts`
    carry an `href`; `OnboardingWizard.tsx:48` renders `<Link href={it.href}>Set up
    →</Link>` for each incomplete item. The 26.25b report's "read-only" label
    referred to it not *writing* settings; it does link to each settings page.

## بند ۲ — BUG-010 second root + BUG-011
- **2.1 context-aware nav (DONE):** `workspaceForPath(pathname, currentWorkspaceId?)`
  now keeps a user in their current workspace for a **cross-listed** page, instead of
  jumping to the first-listed owner (the reported jump's true second root). Wired in
  `AdminSidebar` via a sticky `lastWsRef`. The prompt's "keep current workspace, not
  executive" requirement is now implemented.
- **Cross-listed paths (17):** `/admin/dashboard`(exec,analytics),
  `/admin/content`,`/admin/blog`,`/admin/media`(brand,content),`/admin/docs`(content,
  documentation),`/admin/ai-kb`,`/admin/ai-prompts`(content,ai),`/admin/finance`,
  `/admin/documents`,`/admin/company`,`/admin/numbering`(erp,system),
  `/admin/reports`(erp,analytics),`/admin/ai-analytics`(ai,analytics),
  `/admin/security`,`/admin/flags`(security,system),`/admin/logs-monitoring`(operations,
  system),`/admin/seo`(analytics,system).
- **2.2 test restored (DONE):** the STRONG assertion is back for single-owner items
  (resolve to exactly their workspace); cross-listed items use the context-aware
  assertion. Logged as **CC-002** in contract-changes.md. `workspaces.test.ts` = 25
  tests.
- **2.3 BUG-011 super_admin count: DEFERRED to pass 2.** The code fix is real (grid +
  dropdown both read `visibleWorkspaces(role)`; for super_admin that is all 12).
  Honest gap: the **live-browser count with the maintainer's super_admin account has
  not been run** in this turn (needs a running app + login). If the symptom persists
  at 6, the remaining suspects to check live are the dropdown container
  `max-h-[70vh]` (scroll affordance was added) and `nav_prefs` fav/recent grouping.
  Plan: fold into the pass-2 Playwright run (assert dropdown item count === grid
  count === 12 for super_admin).

## بند ۳ / بند ۴ — CFO + QA hunts: DEFERRED to pass 2
Both are large, live-PG/live-browser numeric sweeps (8 CFO scenarios with before/
after balances; 7 QA categories incl. ~80 empty-DB sections + a role×route 403
matrix). They are **not** started in pass 1 (honest — no silent partial). Pass 2 will
produce the two findings tables (CFO numeric, QA BUG-XXX) per the specified method.

## بند ۵ — ADR-002 (DONE, design only): `docs/governance/ADR-002-granular-rbac.md`
Resolves the two serious flaws in the 26.26 sketch: (1) the `x-pathname` header is
rejected as sole mechanism — permission keys are **route-literal**, middleware
**unconditionally overwrites** the header, + a mandatory forged-header penetration
test; (2) permission keys are **operation-scoped** (`…:post` ≠ `…:draft`), with the
op-multiplexed routes enumerated. SoD (26.24b) is AND-ed with grants. **No RBAC
table/route/UI built (R8).**

## Gates (pass 1)
TS **0** · ESLint **0** · **756 unit tests** (+4: nav context-aware ×3, scrypt
self-describing ×1) · **10 governance audits 0** (incl. `audit:nav` + `audit:i18n`
with the locked baseline) · **regressions 10/10** (verify-2620/2621/2623/2624/2624b/
2625/2625s/2625a/2625b/2626).

## Mandatory attestation table

| Item | Status | Evidence |
|---|---|---|
| R1 branch discipline | done | worked only on `feature/v2`; no side-branch push this phase |
| R2 no force-push | done | this phase: FF only (see push log); rule added to CLAUDE.md |
| R8 no RBAC impl | done | only ADR-002 written; zero RBAC tables/routes/UI |
| بند ۰.۱ raw state + answers | done | git output + answers above |
| بند ۰.۲ work on right branch | already done + verified | `feature/v2`=a08223e via PR#5/#6; FF sync; all 26.25b commits reachable |
| بند ۰.۳ root cause + rule | done | harness branch-requirement surfaced; CLAUDE.md rule 5 updated |
| بند ۱.۱ contract-change doc | done | `contract-changes.md` CC-001; CLAUDE.md rule |
| بند ۱.۲ "has E2E ever run?" | done (answer) | **NO — never executed**, stated + CI plan |
| بند ۱.۲ real E2E run | **deferred pass 2** | needs live app+DB+browser; CI job specified |
| بند ۱.۳ i18n baseline lock | done | `i18n-baseline.json`=28; audit fails on increase (exit-1 path) |
| بند ۱.۴ scrypt self-describing | done + verified | format `scrypt$N$r$p$…`; params read from string; `password.test.ts` new test (N=16384/8192 verify) |
| بند ۱.۴ onboarding links | already done + verified | `onboarding.ts` 10 hrefs; `OnboardingWizard.tsx:48` Link |
| بند ۲.۱ context-aware nav | done | `workspaceForPath(pathname, currentId?)` + sticky `lastWsRef`; tests |
| بند ۲.۲ strong test restored | done | `workspaces.test.ts` single-owner strong + context-aware; CC-002 |
| بند ۲.۳ BUG-011 super_admin live count | **deferred pass 2** | code fix real (visibleWorkspaces); live-browser count not run this turn |
| بند ۳ CFO hunt (8 scenarios) | **deferred pass 2** | large live-PG numeric sweep; not started (no partial) |
| بند ۴ QA hunt (7 categories) | **deferred pass 2** | ~80 empty-DB sections + 403 matrix; not started |
| بند ۵ ADR-002 | done | `ADR-002-granular-rbac.md` (both flaws resolved) |
| gates: TS/ESLint/audits/tests/regressions | done | 0 · 0 · 10×0 · 756 · 10/10 |

## Changelog (pass 1)
`workspaces.ts` (context-aware `workspaceForPath`), `AdminSidebar.tsx` (sticky
workspace), `workspaces.test.ts` (+3), `password.test.ts` (+1),
`scripts/i18n-audit.mjs` + `scripts/i18n-baseline.json` (baseline lock),
`contract-changes.md`, `ADR-002-granular-rbac.md`, CLAUDE.md (rules 5 force-push +
regression-log), this report.
