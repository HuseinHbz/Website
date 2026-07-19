/**
 * Serial / Batch / IMEI platform — pure engine (Phase 26.19, PART 4).
 * Deterministic, no DB: IMEI Luhn validation, the serial lifecycle state
 * machine, warranty state and batch/lot expiry helpers. The registries live in
 * inv_serials / inv_batches (serialData.ts persists).
 */

// ── IMEI: 15 digits with a Luhn check digit ──────────────────────────────────
export function isValidImei(v: string | null | undefined): boolean {
  if (!v) return false
  const s = v.trim()
  if (!/^\d{15}$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let d = Number(s[i])
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

/** Serial numbers: 3–64 chars, letters/digits/dash/underscore/dot. */
export function isValidSerial(v: string | null | undefined): boolean {
  if (!v) return false
  return /^[A-Za-z0-9._-]{3,64}$/.test(v.trim())
}

// ── Serial lifecycle ─────────────────────────────────────────────────────────
export const SERIAL_STATUSES = ['in_stock', 'reserved', 'sold', 'returned', 'damaged', 'recalled'] as const
export type SerialStatus = (typeof SERIAL_STATUSES)[number]

const SERIAL_FLOW: Record<SerialStatus, SerialStatus[]> = {
  in_stock: ['reserved', 'sold', 'damaged', 'recalled'],
  reserved: ['in_stock', 'sold'],
  sold: ['returned', 'recalled'],
  returned: ['in_stock', 'damaged', 'recalled'],
  damaged: ['recalled'],
  recalled: [],
}
export function canTransitionSerial(from: SerialStatus, to: SerialStatus): boolean {
  return (SERIAL_FLOW[from] ?? []).includes(to)
}

// ── Warranty ─────────────────────────────────────────────────────────────────
export type WarrantyState = 'active' | 'expiring' | 'expired' | 'none'
/** Warranty from a start date + months; `expiring` inside the last 30 days. */
export function warrantyStatus(startDate: string | null, months: number | null, today: string): WarrantyState {
  if (!startDate || !months || months <= 0) return 'none'
  const end = new Date(startDate)
  end.setMonth(end.getMonth() + months)
  const daysLeft = (end.getTime() - new Date(today).getTime()) / 86400000
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 30) return 'expiring'
  return 'active'
}

// ── Batch helpers ────────────────────────────────────────────────────────────
export interface BatchInput { batchNo: string; expiryDate?: string | null; productionDate?: string | null }
export function isValidBatchNo(v: string | null | undefined): boolean {
  if (!v) return false
  return /^[A-Za-z0-9._/-]{2,64}$/.test(v.trim())
}
/** Production must precede expiry when both are present. */
export function batchDatesValid(b: BatchInput): boolean {
  if (b.productionDate && b.expiryDate) return new Date(b.productionDate) <= new Date(b.expiryDate)
  return true
}

/** A recall marks every serial of the affected set — pure planner. */
export function recallPlan(serials: { id: number; status: SerialStatus }[]): { id: number; from: SerialStatus }[] {
  return serials.filter(s => canTransitionSerial(s.status, 'recalled')).map(s => ({ id: s.id, from: s.status }))
}
