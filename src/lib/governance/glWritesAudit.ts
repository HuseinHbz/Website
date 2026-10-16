/**
 * ERPFIX-1 (BUG-ERP-08) — pure scanner behind `npm run audit:gl-writes`.
 *
 * A POSTED journal entry may be written from exactly one place:
 * `insertPostedEntry` in src/lib/erp/glPosting.ts (period gate + balance check
 * + Numbering Engine + atomic). Any other `INSERT INTO gl_journal_entries` /
 * `gl_journal_lines` — or a raw `status='posted'` flip — in src/ or deploy/ is
 * a bypass and fails the build. The allowlist is short, explicit and every
 * entry carries a written reason; an allowlisted file may only do what its
 * reason says (the journal route may only insert DRAFTS).
 */

export interface SourceFile { path: string; text: string }
export interface GlWriteViolation { path: string; line: number; kind: 'entry_insert' | 'line_insert' | 'status_posted'; snippet: string; why: string }

/** The single GL entry point + the migration file own the tables. */
export const GL_CORE_FILES = new Set(['src/lib/erp/glPosting.ts', 'src/lib/db/migrate.ts'])

/** This scanner names the patterns it looks for. */
const SELF = 'src/lib/governance/glWritesAudit.ts'

export interface AllowEntry { reason: string; kinds: GlWriteViolation['kind'][]; mustContain?: RegExp }
export const GL_WRITES_ALLOWLIST: Record<string, AllowEntry> = {
  'src/app/api/admin/erp/finance/journal/route.ts': {
    reason: 'Manual journal: creates and edits DRAFT entries only (status literal \'draft\'); posting a draft goes through postEntryById in the core.',
    kinds: ['entry_insert', 'line_insert'],
    mustContain: /INSERT INTO gl_journal_entries[\s\S]{0,400}?'draft'/,
  },
  'deploy/fix-bug020-data.ts': {
    reason: 'One-off BUG-020 data repair (dry-run by default): restores status=\'posted\' on originals that the old reverseEntry had voided. Writes no new entry.',
    kinds: ['status_posted'],
  },
}

const PATTERNS: { kind: GlWriteViolation['kind']; re: RegExp }[] = [
  { kind: 'entry_insert', re: /INSERT\s+INTO\s+gl_journal_entries\b/gi },
  { kind: 'line_insert', re: /INSERT\s+INTO\s+gl_journal_lines\b/gi },
  { kind: 'status_posted', re: /UPDATE\s+gl_journal_entries\s+SET\s+status\s*=\s*'posted'/gi },
]

export function scanGlWrites(files: SourceFile[]): GlWriteViolation[] {
  const out: GlWriteViolation[] = []
  for (const f of files) {
    if (GL_CORE_FILES.has(f.path) || f.path === SELF) continue
    const allow = GL_WRITES_ALLOWLIST[f.path]
    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(f.text))) {
        const line = f.text.slice(0, m.index).split('\n').length
        const snippet = f.text.split('\n')[line - 1].trim().slice(0, 160)
        if (allow && allow.kinds.includes(kind)) {
          if (kind === 'entry_insert' && allow.mustContain) {
            const window = f.text.slice(m.index, m.index + 420)
            allow.mustContain.lastIndex = 0
            if (!allow.mustContain.test(window)) {
              out.push({ path: f.path, line, kind, snippet, why: `allowlisted only for: ${allow.reason}` })
            }
          }
          continue
        }
        out.push({ path: f.path, line, kind, snippet, why: 'write the entry through insertPostedEntry (src/lib/erp/glPosting.ts)' })
      }
    }
  }
  return out
}
