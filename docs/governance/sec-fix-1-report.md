# SEC-FIX-1 — SQL Injection in the Approval Center + manual escaping in period closing

Two real defects found by direct code reading (not guessed), both fixed; a
permanent CI gate built against the whole class; two additional real
instances of the same anti-pattern found during the gate's own scan and
fixed in the same phase (never deferred).

## بند۰ — The two reported bugs

### BUG-ERP-01 (critical) — unparametrized `tab` reaching raw SQL text

`src/app/api/admin/erp/approvals/route.ts` read `?tab=` with a bare
TypeScript `as` cast (no runtime check) and passed it straight to
`inbox()` (`src/lib/erp/approvalData.ts`). For any value other than
`pending`/`delegated`/`expired`, `inbox()` built:

```ts
const status = tab === 'pending' ? `status IN (...)` : `status='${tab}'`
return pgQuery(`SELECT ... WHERE ${status} ...`)  // no parameter at all
```

Any logged-in user with `erp.approvals:read` (CEO, Auditor, most
admin/finance roles) could send `?tab=x' UNION SELECT ... --` and read any
other table in the database. PoC shape (internal only):

```
GET /api/admin/erp/approvals?tab=x%27%20UNION%20SELECT%20id,email,password_hash,...%20FROM%20users--
```

### BUG-ERP-02 (medium) — manual string-escaping instead of a bound param

`src/lib/erp/accountingData.ts`'s `transitionPeriod`:

```ts
const stamp = to === 'closed' ? `, closed_at=${NOW}, closed_by=${userId ? `'${userId.replace(/'/g, "''")}'` : 'NULL'}` : ...
```

Not reachable with attacker-controlled input today (`userId` comes from
the server session), but a direct violation of the project's own
$n-parametrized-only rule.

## بند۱ — Fix: BUG-ERP-01

Two independent layers, per the instruction ("دفاع دوگانه الزامی است"):

1. **Route** (`route.ts`): `?tab=` is now validated with a real zod enum
   (`z.enum(['pending','approved','rejected','delegated','expired'])`)
   before `inbox()` is ever called. An invalid value → `400`, never a
   silent fallback to `'pending'`.
2. **`inbox()` itself** (`approvalData.ts`): rewritten so NO value is ever
   interpolated into the SQL text — even the `'approved'`/`'rejected'`
   branch is now `WHERE status=$1` with a real parameter. The reference
   safe shape this project already had in two other places
   (`treasury/paymentData.ts#listPayments`, `bi/slaData.ts#listSlaEvents`:
   `gate` only ever picks between two hardcoded literal fragments, the
   real value always travels through `$1`) is now followed here too.

Both layers are real: even if the route's validation ever regressed again,
`inbox()` can no longer be exploited by any string value.

## بند۲ — Fix: BUG-ERP-02

`transitionPeriod` no longer builds the `closed_by` fragment by
hand-escaping `userId`. `$3` now carries the real value; the `CASE`-shaped
choice of which (already-hardcoded) column set to stamp is unchanged —
same observable behavior, parametrized mechanism. Verified live with a
`userId` containing a literal `'` (see بند۴).

## بند۳ — Permanent CI gate: `audit:sql` (`npm run audit:sql`)

New script `scripts/sql-injection-audit.mjs`, wired into `npm run audit`
and therefore CI (`.github/workflows/ci.yml`'s `npm run audit` step).
Scans every `pgQuery(` / `query(` template literal under `src/lib/**` and
`src/app/api/**` that looks like SQL, and classifies every `${...}`
interpolation inside it. Allowed, in order:

1. `${NOW}` — the one well-known timestamp constant.
2. A bare identifier (or `arr.length [+ N]` placeholder-index expression)
   whose value is provably composed ONLY of hardcoded literal SQL
   fragments — via a ternary, a `let`-reassignment chain across an `if`
   block, or a `.push()`-built array joined with a literal separator
   (the `gate`/`where`/`conds`/`sets`/`parts` shape already used correctly
   elsewhere in this codebase). The real value must still travel through a
   real `$n` — the gate does not (and cannot by itself) verify that half;
   it only closes the "raw value spliced into SQL text" class.
3. An inline literal-only ternary written directly inside `${...}`.

Everything else fails, unless explicitly allowlisted with a one-line
reason (never silently).

### First scan results — 35 raw findings, triaged to zero

Running the gate against the whole codebase for the first time surfaced
35 candidates. After manual verification:

- **2 already fixed above** (BUG-ERP-01's `inbox()`, BUG-ERP-02).
- **2 additional REAL findings — fixed in this same phase, not deferred:**
  - `src/app/api/admin/erp/assets/route.ts` (`PUT`): the recomputed
    `exchange_rate` (a number from `rialRateFor()`) was spliced directly
    into the `UPDATE` text instead of travelling through a bound param.
    Unexploitable in practice (always a JS number, never a string with
    quote characters) but the same anti-pattern as BUG-ERP-02 — fixed the
    same way: the value now travels through a new `$n` param.
  - `src/app/api/admin/erp/integrations/dispatch/route.ts` (`GET`): the
    `connectorId` query param (`Number(...) || 0`) was spliced directly
    into `WHERE d.connector_id=${cid}`. Same class, same fix: `$1`.
- **15 genuine false positives** — verified safe by hand, documented in
  `ALLOWLIST` inside `scripts/sql-injection-audit.mjs` with a one-line
  reason each (closed internal arrays/const objects never touched by
  request input; zod-`enum`-constrained values picked from a closed
  lookup map; the shared `rowScopeSql()` helper, whose own SQL is
  `$n`-parametrized and whose `ownerExpr` argument is always a
  call-site-hardcoded column reference; values enumerated from
  `information_schema.tables`/re-validated against a closed allowlist
  before use; and a handful of pure placeholder-generation expressions
  like `values(d).map((_,i)=>\`$${i+1}\`).join(',')` that never carry a
  value, only `$n` text).
- **16 remaining were resolved by extending the gate's own classifier**
  (not by allowlisting) to recognize the `let`-reassignment-chain and
  `.push()`-array patterns this codebase already used safely in several
  places, since weakening the gate to "whatever passes" would defeat its
  purpose — the classifier now genuinely verifies the shape rather than
  trusting it.

Final result: **`audit:sql` → 0 unsafe interpolations, budget 0.**

## بند۴ — Live PostgreSQL proof

`scripts/verify-sec-fix1.ts` — **20/20 assertions pass** against a real
PostgreSQL instance, registered as a regression suite in
`scripts/ci-regressions.ts` (full run: all prior suites + this one green).

Covers:
1. All 5 valid `tab` values still work through `inbox()` with no
   regression (pending/approved/rejected filter correctly via the new
   `$1`-parametrized query).
2. The route-level zod gate rejects a real injection payload on `?tab=`
   outright (confirmed `safeParse` failure → would be a 400); as defense
   in depth, `inbox()` itself — even called directly with the raw
   malicious string, bypassing the route — never returns another table's
   columns (`email`/`password_hash`), because it never interpolates the
   value into SQL text at all.
3. `transitionPeriod` no longer crashes on a `userId` containing a literal
   `'`, and the value lands in `closed_by` EXACTLY as given (via the real
   `$3` param, not an escaped/mangled string) — the `gl_fiscal_periods` row
   survives intact.

Gates: TypeScript 0 errors · ESLint 0 · `npm run build` clean ·
`npm run audit` (10 governance audits incl. the new `audit:sql`) clean ·
1334/1334 unit tests · full regression suite green (previous suites
unaffected + the new SEC-FIX-1 suite).

## New CLAUDE.md rule

Added verbatim (see CLAUDE.md working rules):

> «هیچ مقدار غیرثابتی مستقیم در متن یک کوئری pgQuery درج نشود؛ حتی
> فیلترهای اختیاری فقط بین چند رشتهٔ SQL ثابت انتخاب می‌شوند، مقدار واقعی
> همیشه از طریق $n می‌رود؛ این با audit گیت دائمی در CI اعمال می‌شود.»

## Explicit confirmations (per the task's prohibitions)

- This was a security patch, not a refactor: no API response shape,
  parameter name, or observable behavior changed (`tab` filtering,
  `transitionPeriod`'s column-stamping behavior, the assets `PUT`
  response, the integrations dispatch list — all identical to before).
- The new `audit:sql` gate was never weakened to let the two real bugs
  pass — both were genuinely fixed, and the gate's classifier was
  extended with real verification logic (not loosened heuristics) to
  correctly recognize the codebase's pre-existing safe patterns.
- The two additional real findings (assets `rateSql`, integrations
  `cid`) were fixed in this same phase, not deferred to a future one.
