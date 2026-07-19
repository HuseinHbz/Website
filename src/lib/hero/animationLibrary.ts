/**
 * Hero Animation Library — package / signature / dependency engine (Phase 25.2).
 *
 * Pure, unit-tested. Powers import/export of animation (and template) packages
 * with tamper detection: a package carries a SHA-256 checksum over its canonical
 * body plus an HMAC signature keyed by a server secret. Dependency + conflict
 * validation runs before any import so invalid packages are rejected. Marketplace
 * metadata is included so the same format is reusable by a future marketplace
 * without depending on one existing today.
 */
import crypto from 'node:crypto'
import { isKnownAnimation, isKnownAnimation as knownAnim } from './animations'
import { isKnownTemplate } from './templates'

export const PACKAGE_SCHEMA = 'hbz.hero.package/1'
export type PackageKind = 'animation' | 'template' | 'theme' | 'asset'

export interface PackagePresetItem {
  key: string
  nameEn: string
  nameFa: string
  category: string
  basePreset?: string
  config: Record<string, unknown>
  tags?: string[]
}
export interface PackageMeta {
  kind: PackageKind
  name: string
  version: string           // semver-ish
  author?: string
  organization?: string
  license?: string
  compatibility?: string    // platform version range this package targets
  createdAt: string
  screenshots?: string[]
}
export interface HeroPackage {
  schema: string
  meta: PackageMeta
  items: PackagePresetItem[]
  /** deps the importer must satisfy (built-in preset ids / template ids). */
  dependencies?: { presets?: string[]; templates?: string[] }
  checksum: string          // sha256 over canonical(body)
  signature: string         // hmac-sha256(checksum, secret)
}

/** Deterministic JSON (sorted keys) so checksums are stable across environments. */
export function canonicalize(v: unknown): string {
  const seen = new WeakSet()
  const norm = (x: unknown): unknown => {
    if (x && typeof x === 'object') {
      if (seen.has(x as object)) return null
      seen.add(x as object)
      if (Array.isArray(x)) return x.map(norm)
      return Object.keys(x as Record<string, unknown>).sort().reduce((o, k) => {
        o[k] = norm((x as Record<string, unknown>)[k]); return o
      }, {} as Record<string, unknown>)
    }
    return x
  }
  return JSON.stringify(norm(v))
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}
function hmac(s: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(s).digest('hex')
}

/** The body (everything the checksum covers) — meta + items + dependencies. */
function packageBody(pkg: Pick<HeroPackage, 'schema' | 'meta' | 'items' | 'dependencies'>): string {
  return canonicalize({ schema: pkg.schema, meta: pkg.meta, items: pkg.items, dependencies: pkg.dependencies ?? {} })
}

/** Build a signed, self-describing package from a set of preset items. */
export function buildPackage(
  meta: Omit<PackageMeta, 'createdAt'> & { createdAt?: string },
  items: PackagePresetItem[],
  secret: string,
  dependencies?: HeroPackage['dependencies'],
): HeroPackage {
  const full: Pick<HeroPackage, 'schema' | 'meta' | 'items' | 'dependencies'> = {
    schema: PACKAGE_SCHEMA,
    meta: { ...meta, createdAt: meta.createdAt ?? new Date().toISOString() },
    items,
    dependencies: dependencies ?? autoDependencies(items),
  }
  const checksum = sha256Hex(packageBody(full))
  return { ...full, checksum, signature: hmac(checksum, secret) }
}

/** Infer built-in dependencies from the items (base presets they derive from). */
export function autoDependencies(items: PackagePresetItem[]): HeroPackage['dependencies'] {
  const presets = [...new Set(items.map(i => i.basePreset).filter((x): x is string => !!x))]
  return presets.length ? { presets } : {}
}

export interface VerifyResult { ok: boolean; tampered: boolean; signatureValid: boolean; reasons: string[] }
/** Verify checksum integrity + HMAC signature (tamper detection). */
export function verifyPackage(pkg: HeroPackage, secret: string): VerifyResult {
  const reasons: string[] = []
  if (pkg.schema !== PACKAGE_SCHEMA) reasons.push(`Unsupported schema "${pkg.schema}".`)
  const recomputed = sha256Hex(packageBody(pkg))
  const tampered = recomputed !== pkg.checksum
  if (tampered) reasons.push('Checksum mismatch — package body was modified.')
  const signatureValid = !tampered && safeEqual(hmac(pkg.checksum, secret), pkg.signature)
  if (!tampered && !signatureValid) reasons.push('Invalid signature — not signed by this platform.')
  return { ok: reasons.length === 0, tampered, signatureValid, reasons }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export interface DependencyReport { ok: boolean; missingPresets: string[]; missingTemplates: string[] }
/** Validate that every dependency a package declares is available in this build. */
export function validateDependencies(pkg: HeroPackage): DependencyReport {
  const missingPresets = (pkg.dependencies?.presets ?? []).filter(p => !isKnownAnimation(p))
  const missingTemplates = (pkg.dependencies?.templates ?? []).filter(t => !isKnownTemplate(t))
  // Items whose basePreset is unknown are also missing deps.
  for (const it of pkg.items) if (it.basePreset && !knownAnim(it.basePreset) && !missingPresets.includes(it.basePreset)) missingPresets.push(it.basePreset)
  return { ok: missingPresets.length === 0 && missingTemplates.length === 0, missingPresets, missingTemplates }
}

export interface ImportPlan { toCreate: PackagePresetItem[]; conflicts: string[]; invalid: string[] }
/** Split a package's items into new vs conflicting (existing key) vs invalid. */
export function planImport(pkg: HeroPackage, existingKeys: string[]): ImportPlan {
  const existing = new Set(existingKeys)
  const seen = new Set<string>()
  const toCreate: PackagePresetItem[] = []
  const conflicts: string[] = []
  const invalid: string[] = []
  for (const it of pkg.items) {
    if (!it.key || !it.nameEn || !it.category) { invalid.push(it.key || '(no key)'); continue }
    if (existing.has(it.key) || seen.has(it.key)) { conflicts.push(it.key); continue }
    seen.add(it.key); toCreate.push(it)
  }
  return { toCreate, conflicts, invalid }
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface UsageRow { key: string; nameEn: string; category: string; usageCount: number; enabled: boolean }
export interface LibraryAnalytics {
  total: number; enabled: number; archived: number
  mostUsed: UsageRow[]; leastUsed: UsageRow[]
  byCategory: { category: string; count: number; usage: number }[]
}
/** Roll library usage rows into an analytics summary. */
export function animationAnalytics(rows: UsageRow[], archivedCount = 0): LibraryAnalytics {
  const sorted = [...rows].sort((a, b) => b.usageCount - a.usageCount)
  const cat = new Map<string, { count: number; usage: number }>()
  for (const r of rows) {
    const c = cat.get(r.category) ?? { count: 0, usage: 0 }
    c.count++; c.usage += r.usageCount; cat.set(r.category, c)
  }
  return {
    total: rows.length,
    enabled: rows.filter(r => r.enabled).length,
    archived: archivedCount,
    mostUsed: sorted.slice(0, 10),
    leastUsed: [...sorted].reverse().filter(r => r.usageCount === 0 || true).slice(0, 10),
    byCategory: [...cat.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.usage - a.usage),
  }
}
