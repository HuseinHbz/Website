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

export type ChatMsg = { role: 'user' | 'assistant'; content: string }
export type KbSource = { id: number; title: string; excerpt: string }

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
export async function retrieveContext(userMessage: string): Promise<{ contextBlock: string; sources: KbSource[] }> {
  try {
    const db = getDb()
    const terms = userMessage.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const items = await db.select().from(aiKnowledgeBase).where(eq(aiKnowledgeBase.active, true))
    const scored = items.map(item => {
      const haystack = `${item.title} ${item.content || ''} ${item.tags || ''}`.toLowerCase()
      const score = terms.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0)
      return { ...item, score: score + item.priority * 0.1 }
    }).filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)

    if (scored.length === 0) return { contextBlock: '', sources: [] }

    const sources: KbSource[] = scored.map(i => ({ id: i.id, title: i.title, excerpt: (i.content || '').slice(0, 120) }))
    const contextBlock = `\n\n--- KNOWLEDGE BASE CONTEXT ---\n${scored.map((item, idx) => `[${idx + 1}] ${item.title}: ${(item.content || '').slice(0, 600)}`).join('\n\n')}\n--- END CONTEXT ---\n\nWhen relevant, reference the above context and cite sources using [1], [2], etc.`
    return { contextBlock, sources }
  } catch {
    return { contextBlock: '', sources: [] }
  }
}

async function callChatGPT(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string) {
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
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

async function callClaude(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string, useBearer = false) {
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
  const data = await res.json() as { content: { text: string }[] }
  return data.content[0].text
}

async function callGemini(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string) {
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
  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  return data.candidates[0].content.parts[0].text
}

async function callGrok(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string) {
  // Grok uses an OpenAI-compatible API.
  return callChatGPT(apiKey, apiUrl, model || 'grok-beta', messages, systemPrompt)
}

/** Dispatch a single completion to the configured provider (no retry/breaker). */
export function dispatchProvider(cfg: ProviderConfig, messages: ChatMsg[], systemPrompt: string): Promise<string> {
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

export interface CompletionResult { reply: string; sources: KbSource[]; provider: string }

/**
 * Run one completion against the configured provider, with optional RAG,
 * circuit-breaker and retry. This is the single execution path shared by the
 * public chat and every admin AI feature.
 */
export async function runCompletion(opts: {
  messages: ChatMsg[]
  systemPrompt: string
  useRag?: boolean
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

  const reply = await breakers.ai.execute(
    () => retry(() => dispatchProvider(cfg, opts.messages, systemPrompt), {
      attempts: 2,
      baseDelayMs: 500,
      shouldRetry: isTransient,
      onRetry: (err, attempt) => logger.warn('AI retry', { attempt, error: String(err) }),
    }),
    () => FALLBACK_REPLY,
  )
  return { reply, sources, provider: cfg.provider }
}
