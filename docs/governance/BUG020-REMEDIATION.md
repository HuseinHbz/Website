# BUG-020 — Production data remediation runbook

**What happened.** Before the 26.26b deploy, `reverseEntry` set a voided entry's
original to `status='void'` while its reversal stayed `status='posted'`. Because
balance sums count `status='posted'` only, every account touched by a void nets to
**−original instead of 0**. The 26.26b code fix stops NEW voids from doing this, but
any document voided **before** that deploy still carries the broken shape and its
balances are still wrong. This runbook repairs those historical rows.

**Who needs to run this.** Only environments that performed a GL void/reversal
before the 26.26b deploy (a08223e era). If none were, the script reports
"nothing to repair" and exits — running it is still safe.

The repair simply restores the reversed originals to `status='posted'`, so the two
balanced entries (original + reversal) net to zero — exactly like a pair reversed
under the fixed code.

---

## Steps (run on the server, from `/var/www/habibazar`)

### 1. Take a fresh backup (mandatory)
```bash
sudo bash deploy/backup.sh daily        # or the BackupEngine manual run
```
The script **refuses to write** unless a successful backup exists in the last 24h
(or you pass `--i-have-a-backup` to assert one yourself).

### 2. Dry-run — see the scope, change nothing
```bash
DATABASE_URL="$DATABASE_URL" npx tsx scripts/fix-bug020-data.ts
```
Read the output:
- **Victim count** — `reversed_by IS NOT NULL AND status='void'`.
- **Affected entries** — id, entry_no, date, amount, source (sales/purchase/manual).
- **WRONG balances now** — each affected account's balance via the production
  `trialBalance` (this is the number that is currently wrong, e.g. `Bank: -4,000,000`).

If the victim count is **0**, stop — there is nothing to repair (a valid result).

### 3. Apply — restore the reversed originals to `posted`
```bash
DATABASE_URL="$DATABASE_URL" npx tsx scripts/fix-bug020-data.ts --apply --confirm
```
(Both `--apply` and `--confirm` are required. If step 1's backup is older than 24h,
add `--i-have-a-backup`.)

The script prints the **AFTER** balances (e.g. `Bank: -4,000,000 → 0`) and confirms
the trial balance is still balanced. It writes a `logAction`
(`bug020.data.remediation`) with the count + entry ids for the audit trail.

### 4. Verify
- Open **Finance → Reports → Trial Balance** and **Finance → Accounting →
  Ledger validation** (`GET /api/admin/erp/finance/validate`). The affected accounts
  (Bank 1010 / AR 1100 / AP 2000 / Revenue 4000 …) should now show their correct
  balances, and the integrity score should be 100.
- Re-run the script — it must report **0 victims** (idempotent).

---

## Rollback

The change is a single, reversible column flip. If anything looks wrong:

1. **Preferred:** restore the step-1 backup (`sudo bash deploy/restore.sh <file.enc>`).
2. **Targeted (only if you kept the entry ids the script printed):**
   ```sql
   UPDATE gl_journal_entries SET status='void'
   WHERE id = ANY('{<the ids from the apply run>}') AND reversed_by IS NOT NULL;
   ```
   This puts the rows back exactly as they were (still buggy, but the pre-remediation
   state). Only use this if you must revert without a full restore.

## Notes
- The script touches **only** entries that have a reversal (`reversed_by NOT NULL`).
  A plain voided draft (never posted) is never modified.
- Proof uses the production `loadTallies`/`trialBalance` — the same code the Finance
  reports use — not hand-rolled SQL (26.26c بند ۲.۱).
- Verified against a reproduced pre-fix state: `Bank -4,000,000 → 0`,
  `AR 4,000,000 → 0`, trial balance balanced, second run 0 victims.
