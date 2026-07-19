/**
 * Shared AI engine — the single "brain" every AI Platform subsystem composes on
 * (AI Chat Center, AI Agents, and — per the Phase 22 roadmap — Automation,
 * Analytics, Prompt Center). It centralizes what used to live inside the public
 * chat route: provider dispatch (ChatGPT / Claude / Gemini / Grok / Copilot /
 * Conduit), settings loading, RAG retrieval over the knowledge base, and the
 * circuit-breaker + retry wrapper. Callers supply the system prompt and the
 * conversation; nothing here is provider-specific to a single feature.
 */
import { getDb } from '@/lib/db'
import { siteSettings, aiKnowledgeBase } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { breakers } from '@/lib/circuitBreaker'
import { retry, isTransient } from '@/lib/retry'
import { logger } from '@/lib/logger'
import { cosineSim, blendScores, normalize, loadKbEmbeddings, providerEmbedder, type Embedder } from './embeddings'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }
export type KbSource = { id: number; title: string; excerpt: string }
/** Token usage as reported by the provider (fields absent if not returned). */
export type Usage = { inputTokens?: number; outputTokens?: number }
type ProviderReply = { text: string; usage?: Usage }

/** Thrown when the AI provider is not configured (missing API key). */
export class AiConfigError extends Error {}

export interface ProviderConfig {
  provider: string
  apiKey: string
  model: string
  apiUrl: string
}

async function getSetting(key: string): Promise<string> {
  const db = getDb()
  const row = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]
  return row?.value ?? ''
}

/** Read the active provider configuration from site_settings. */
export async function loadProviderConfig(): Promise<ProviderConfig> {
  const [provider, apiKey, model, apiUrl] = await Promise.all([
    getSetting('ai_provider'),
    getSetting('ai_api_key'),
    getSetting('ai_model'),
    getSetting('ai_api_url'),
  ])
  return { provider: provider || 'chatgpt', apiKey, model, apiUrl }
}

/** RAG: rank knowledge-base rows against the query and build a context block. */
export async function retrieveContext(userMessage: string, opts: { embedder?: Embedder } = {}): Promise<{ contextBlock: string; sources: KbSource[] }> {
  try {
    const db = getDb()
    const terms = userMessage.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const items = await db.select().from(aiKnowledgeBase).where(eq(aiKnowledgeBase.active, true))

    // Semantic layer (Phase 22 roadmap closed): when KB rows carry embeddings
    // and an embedder is available, blend cosine similarity with the keyword
    // score. Any failure degrades to keyword-only — never worse than before.
    const kbVectors = await loadKbEmbeddings()
    let queryVec: number[] | null = null
    if (kbVectors.size > 0) {
      const embed = opts.embedder ?? providerEmbedder
      const v = await embed([userMessage])
      queryVec = v?.[0] ?? null
    }

    const keywordRaw = items.map(item => {
      const haystack = `${item.title} ${item.content || ''} ${item.tags || ''}`.toLowerCase()
      return terms.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0)
    })
    const keywordNorm = normalize(keywordRaw)
    const scored = items.map((item, i) => {
      const semantic = queryVec && kbVectors.has(item.id) ? Math.max(0, cosineSim(queryVec, kbVectors.get(item.id)!)) : 0
      const base = queryVec ? blendScores(keywordNorm[i], semantic) : keywordNorm[i]
      return { ...item, score: base + item.priority * 0.01 }
    }).filter(i => i.score > 0.001).sort((a, b) => b.score - a.score).slice(0, 4)

    if (scored.length === 0) return { contextBlock: '', sources: [] }

    const sources: KbSource[] = scored.map(i => ({ id: i.id, title: i.title, excerpt: (i.content || '').slice(0, 120) }))
    const contextBlock = `\n\n--- KNOWLEDGE BASE CONTEXT ---\n${scored.map((item, idx) => `[${idx + 1}] ${item.title}: ${(item.content || '').slice(0, 600)}`).join('\n\n')}\n--- END CONTEXT ---\n\nWhen relevant, reference the above context and cite sources using [1], [2], etc.`
    return { contextBlock, sources }
  } catch {
    return { contextBlock: '', sources: [] }
  }
}

async function callChatGPT(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string): Promise<ProviderReply> {
  const url = `${apiUrl}/chat/completions`
  const body = {
    model: model || 'gpt-4o',
    messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
    max_tokens: 1000,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`AI error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json() as { choices: { message: { content: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  return { text: data.choices[0].message.content, usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens } }
}

async function callClaude(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string, useBearer = false): Promise<ProviderReply> {
  const url = `${apiUrl}/messages`
  const body = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt || undefined,
    messages,
  }
  const authHeader: Record<string, string> = useBearer
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Claude API error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json() as { content: { text: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  return { text: data.content[0].text, usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens } }
}

async function callGemini(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string): Promise<ProviderReply> {
  const url = `${apiUrl}/models/${model || 'gemini-1.5-pro'}:generateContent?key=${apiKey}`
  const contents = (messages as { role: string; content: string }[]).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const body: Record<string, unknown> = { contents }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
  return { text: data.candidates[0].content.parts[0].text, usage: { inputTokens: data.usageMetadata?.promptTokenCount, outputTokens: data.usageMetadata?.candidatesTokenCount } }
}

async function callGrok(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string): Promise<ProviderReply> {
  // Grok uses an OpenAI-compatible API.
  return callChatGPT(apiKey, apiUrl, model || 'grok-beta', messages, systemPrompt)
}

/** Dispatch a single completion to the configured provider (no retry/breaker). */
export function dispatchProvider(cfg: ProviderConfig, messages: ChatMsg[], systemPrompt: string): Promise<ProviderReply> {
  const { provider, apiKey, model, apiUrl } = cfg
  switch (provider) {
    case 'claude':
      return callClaude(apiKey, apiUrl || 'https://api.anthropic.com/v1', model, messages, systemPrompt)
    case 'gemini':
      return callGemini(apiKey, apiUrl || 'https://generativelanguage.googleapis.com/v1beta', model, messages, systemPrompt)
    case 'grok':
      return callGrok(apiKey, apiUrl || 'https://api.x.ai/v1', model, messages, systemPrompt)
    case 'copilot':
      return callChatGPT(apiKey, apiUrl || 'https://api.github.com/copilot', model, messages, systemPrompt)
    case 'conduit': {
      const conduitModel = model || 'claude-sonnet-4-6'
      if (conduitModel.startsWith('claude')) {
        return callClaude(apiKey, 'https://conduit.ozdoev.net/v1', conduitModel, messages, systemPrompt, true)
      }
      return callChatGPT(apiKey, apiUrl || 'https://conduit.ozdoev.net/api/v1', conduitModel, messages, systemPrompt)
    }
    default:
      return callChatGPT(apiKey, apiUrl || 'https://api.openai.com/v1', model, messages, systemPrompt)
  }
}

const FALLBACK_REPLY =
  'متأسفانه در حال حاضر سرویس هوش مصنوعی در دسترس نیست. لطفاً کمی بعد دوباره امتحان کنید. / AI service is temporarily unavailable. Please try again shortly.'

export interface CompletionResult {
  reply: string
  sources: KbSource[]
  provider: string
  usage: Usage
  /** id of the recorded ai_usage row — pass to the feedback endpoint. */
  usageId: number | null
}

/**
 * Run one completion against the configured provider, with optional RAG,
 * circuit-breaker and retry. This is the single execution path shared by the
 * public chat and every admin AI feature. Every call is recorded in `ai_usage`
 * (provider/model/latency/tokens/success/rag) for the AI Analytics subsystem —
 * recording never blocks or fails the response.
 */
export async function runCompletion(opts: {
  messages: ChatMsg[]
  systemPrompt: string
  useRag?: boolean
  /** telemetry label, e.g. 'chat' or 'agent:seo'. */
  source?: string
}): Promise<CompletionResult> {
  const cfg = await loadProviderConfig()
  if (!cfg.apiKey) throw new AiConfigError('AI API key not configured')

  let systemPrompt = opts.systemPrompt
  let sources: KbSource[] = []
  if (opts.useRag) {
    const lastUser = [...opts.messages].reverse().find(m => m.role === 'user')?.content || ''
    const rag = await retrieveContext(lastUser)
    systemPrompt += rag.contextBlock
    sources = rag.sources
  }

  const started = Date.now()
  let usage: Usage = {}
  let success = false
  let errorMsg: string | null = null
  let reply = FALLBACK_REPLY
  try {
    const result = await breakers.ai.execute(
      () => retry(() => dispatchProvider(cfg, opts.messages, systemPrompt), {
        attempts: 2,
        baseDelayMs: 500,
        shouldRetry: isTransient,
        onRetry: (err, attempt) => logger.warn('AI retry', { attempt, error: String(err) }),
      }),
      () => ({ text: FALLBACK_REPLY } as ProviderReply),
    )
    reply = result.text
    usage = result.usage ?? {}
    success = reply !== FALLBACK_REPLY
    if (!success) errorMsg = 'circuit-open/fallback'
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e)
    // still record the failed call below before re-throwing
    await recordUsage({
      provider: cfg.provider, model: cfg.model || '', source: opts.source || 'chat',
      latencyMs: Date.now() - started, success: false, error: errorMsg, usage: {}, ragSources: sources.length,
    }).catch(() => null)
    throw e
  }
  const usageId = await recordUsage({
    provider: cfg.provider,
    model: cfg.model || '',
    source: opts.source || 'chat',
    latencyMs: Date.now() - started,
    success,
    error: errorMsg,
    usage,
    ragSources: sources.length,
  }).catch(() => null)
  return { reply, sources, provider: cfg.provider, usage, usageId }
}

/** Record one AI call into ai_usage (best-effort; returns the new row id). */
async function recordUsage(row: {
  provider: string; model: string; source: string; latencyMs: number
  success: boolean; error: string | null; usage: Usage; ragSources: number
}): Promise<number | null> {
  try {
    const { pgQuery } = await import('@/lib/db')
    const res = await pgQuery(
      `INSERT INTO ai_usage (ts, provider, model, source, latency_ms, success, error, input_tokens, output_tokens, rag_sources)
       VALUES (to_char(now(),'YYYY-MM-DD HH24:MI:SS'), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [row.provider, row.model, row.source, row.latencyMs, row.success ? 1 : 0, row.error,
       row.usage.inputTokens ?? null, row.usage.outputTokens ?? null, row.ragSources],
    )
    return (res[0] as { id: number } | undefined)?.id ?? null
  } catch {
    return null
  }
}
