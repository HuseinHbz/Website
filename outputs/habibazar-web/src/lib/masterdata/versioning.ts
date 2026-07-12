/**
 * Master-data versioning — pure helpers (Phase 26.17 M3). Deterministic diff of
 * an entity's tracked fields, so the data layer can record only real changes into
 * `master_data_history` and later restore a prior version. Distinct from the
 * generic `logAction` audit: this is a per-entity, restorable value store.
 */

export interface FieldChange { field: string; old: unknown; new: unknown }

/** Changed tracked fields between two snapshots (only keys in `fields`). */
export function diffValues(oldObj: Record<string, unknown>, newObj: Record<string, unknown>, fields: string[]): FieldChange[] {
  const out: FieldChange[] = []
  for (const f of fields) {
    const a = oldObj?.[f] ?? null
    const b = newObj?.[f] ?? null
    if (norm(a) !== norm(b)) out.push({ field: f, old: a, new: b })
  }
  return out
}

const norm = (v: unknown): string => (v == null ? '' : typeof v === 'number' ? String(v) : String(v).trim())

/** True when at least one tracked field changed. */
export function hasChanges(oldObj: Record<string, unknown>, newObj: Record<string, unknown>, fields: string[]): boolean {
  return diffValues(oldObj, newObj, fields).length > 0
}

export interface HistoryEntry { id: number; version: number; oldValue: string | null; newValue: string | null; changedBy: string | null; changeReason: string | null; createdAt: string }

/** Parse the new_value JSON of a history entry back into a restore payload. */
export function restorePayload(entry: Pick<HistoryEntry, 'newValue'>): Record<string, unknown> | null {
  if (!entry.newValue) return null
  try { const v = JSON.parse(entry.newValue); return v && typeof v === 'object' ? v as Record<string, unknown> : null } catch { return null }
}

/** Compare two versions of a tracked entity for a diff view. */
export function compareVersions(a: Pick<HistoryEntry, 'newValue'>, b: Pick<HistoryEntry, 'newValue'>, fields: string[]): FieldChange[] {
  const av = restorePayload(a) ?? {}
  const bv = restorePayload(b) ?? {}
  return diffValues(av, bv, fields)
}
