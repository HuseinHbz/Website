/**
 * Numbering Engine — module integration helper (Phase 21.11, item 1).
 *
 * The one function every module calls to get its next document number. It routes
 * through the concurrency-safe engine (`generateDocumentNumber`); if no format is
 * configured for the type (e.g. a very old DB before the seed ran) it degrades to
 * a safe legacy-style fallback so a document create can never hard-fail on
 * numbering. Default formats for the built-in types are seeded in migrate.ts.
 */
import { generateDocumentNumber, generateDocumentNumberInTx, type GenerateScope } from './service'
import { logger } from '@/lib/logger'

export interface NextNumberOpts {
  module?: string
  userId?: string | null
  ip?: string | null
  scope?: GenerateScope
  legacyPrefix?: string
}

export async function nextNumber(docType: string, opts: NextNumberOpts = {}): Promise<string> {
  try {
    const g = await generateDocumentNumber({
      docType,
      module: opts.module,
      source: opts.module ?? 'module',
      userId: opts.userId ?? null,
      ip: opts.ip ?? null,
      scope: opts.scope,
    })
    return g.number
  } catch (e) {
    logger.warn('numbering.fallback', { docType, error: e instanceof Error ? e.message : String(e) })
    const prefix = opts.legacyPrefix ?? (docType.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'DOC')
    return `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
  }
}

type Q = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>

/**
 * ERPFIX-1 — like nextNumber, but minted inside the caller's transaction on
 * its own connection (see generateDocumentNumberInTx). When no format is
 * configured it degrades to the same legacy-style fallback as nextNumber.
 */
export async function nextNumberInTx(query: Q, docType: string, opts: NextNumberOpts = {}): Promise<string> {
  const g = await generateDocumentNumberInTx(query, {
    docType, module: opts.module, source: opts.module ?? 'module',
    userId: opts.userId ?? null, ip: opts.ip ?? null, scope: opts.scope,
  })
  if (g) return g.number
  logger.warn('numbering.fallback', { docType, error: 'no active numbering format' })
  const prefix = opts.legacyPrefix ?? (docType.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'DOC')
  return `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
}
