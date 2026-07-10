/**
 * Embeddings + vector search for RAG (closes the Phase-22 roadmap item).
 *
 * Semantic retrieval on top of the keyword scorer: KB entries carry an optional
 * embedding vector (JSON array in ai_knowledge_base.embedding, computed via the
 * configured OpenAI-compatible provider's /embeddings endpoint). Retrieval
 * blends normalized keyword + cosine scores; when no embeddings/provider are
 * available it degrades to the original keyword-only behaviour — never worse,
 * never blocking. The math is pure and unit-tested; the HTTP embedder is
 * injectable so tests are deterministic.
 */
import { pgQuery } from '@/lib/db'
import { loadProviderConfig } from './engine'

// ── Pure math ────────────────────────────────────────────────────────────────
/** Cosine similarity of two vectors (0 when degenerate). */
export function cosineSim(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** Blend a normalized keyword score with a semantic score (both 0..1). */
export function blendScores(keyword: number, semantic: number, semanticWeight = 0.6): number {
  const w = Math.max(0, Math.min(1, semanticWeight))
  return keyword * (1 - w) + semantic * w
}

/** Normalize raw keyword hit-counts to 0..1 against the best in the batch. */
export function normalize(scores: number[]): number[] {
  const max = Math.max(0, ...scores)
  return max === 0 ? scores.map(() => 0) : scores.map(s => s / max)
}

// ── Embedder (OpenAI-compatible; injectable) ─────────────────────────────────
export type Embedder = (texts: string[]) => Promise<number[][] | null>

/** Providers whose apiUrl speaks the OpenAI /embeddings dialect. */
const EMBEDDING_PROVIDERS = new Set(['chatgpt', 'openai', 'conduit'])

/**
 * Embed texts through the configured provider. Returns null (→ keyword-only
 * fallback) when the provider has no embeddings endpoint, no key, or errors.
 */
export const providerEmbedder: Embedder = async (texts) => {
  try {
    const cfg = await loadProviderConfig()
    if (!cfg.apiKey || !EMBEDDING_PROVIDERS.has(cfg.provider)) return null
    const url = `${cfg.apiUrl || 'https://api.openai.com/v1'}/embeddings`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.map(t => t.slice(0, 8000)) }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data?: { index: number; embedding: number[] }[] }
    if (!data.data?.length) return null
    const out: number[][] = new Array(texts.length)
    for (const d of data.data) out[d.index] = d.embedding
    return out.every(Boolean) ? out : null
  } catch { return null }
}

// ── KB embedding storage ─────────────────────────────────────────────────────
/** Load stored KB embeddings (id → vector). Missing column/rows → empty map. */
export async function loadKbEmbeddings(): Promise<Map<number, number[]>> {
  try {
    const rows = await pgQuery<{ id: number; embedding: string }>(
      `SELECT id, embedding FROM ai_knowledge_base WHERE embedding IS NOT NULL AND active = true`)
    const map = new Map<number, number[]>()
    for (const r of rows) {
      try {
        const v = JSON.parse(r.embedding) as number[]
        if (Array.isArray(v) && v.length) map.set(r.id, v)
      } catch { /* skip bad row */ }
    }
    return map
  } catch { return new Map() }
}

/** Store an embedding for a KB entry (best-effort). */
export async function storeKbEmbedding(id: number, vector: number[]): Promise<void> {
  try { await pgQuery(`UPDATE ai_knowledge_base SET embedding=$2 WHERE id=$1`, [id, JSON.stringify(vector)]) } catch { /* best-effort */ }
}

/**
 * Backfill embeddings for KB entries that lack one (called from the KB sync).
 * Batches through the embedder; silently no-ops without a provider.
 */
export async function backfillKbEmbeddings(embedder: Embedder = providerEmbedder, limit = 50): Promise<number> {
  try {
    const rows = await pgQuery<{ id: number; title: string; content: string | null }>(
      `SELECT id, title, content FROM ai_knowledge_base WHERE embedding IS NULL AND active = true LIMIT $1`, [limit])
    if (!rows.length) return 0
    const vectors = await embedder(rows.map(r => `${r.title}\n${(r.content || '').slice(0, 4000)}`))
    if (!vectors) return 0
    let n = 0
    for (let i = 0; i < rows.length; i++) {
      if (vectors[i]?.length) { await storeKbEmbedding(rows[i].id, vectors[i]); n++ }
    }
    return n
  } catch { return 0 }
}
