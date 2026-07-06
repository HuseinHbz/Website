import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { aiModules, siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { limiters } from '@/lib/rateLimit'
import { guardMessages, sanitize, REFUSAL, MAX_MESSAGE_LEN, MAX_MESSAGES } from '@/lib/ai/guard'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'

// Public, untrusted input — validate + cap. The client may only send
// user/assistant turns; a client-supplied `system` role is rejected so it cannot
// smuggle its own system prompt past ours.
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(MAX_MESSAGE_LEN),
  })).min(1).max(MAX_MESSAGES),
  locale: z.enum(['en', 'fa']).optional(),
  chatContext: z.string().max(2000).optional(),
  moduleSlug: z.string().max(80).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit (abuse / cost protection): 20 req/min per IP.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const rl = limiters.ai(ip)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } })
    }

    // Validate + cap untrusted input.
    let raw: unknown
    try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    const parsed = chatSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const { messages: rawMessages, locale, chatContext, moduleSlug } = parsed.data

    // AI security: detect prompt-injection / jailbreak / exfiltration attempts.
    const guard = guardMessages(rawMessages)
    if (guard.verdict === 'block') {
      logger.security('AI prompt-injection blocked', { ip, risk: guard.risk, reasons: guard.reasons.join(','), source: 'ai' })
      return NextResponse.json({ reply: REFUSAL, sources: [], blocked: true })
    }
    if (guard.risk === 'low') {
      logger.warn('AI input flagged', { ip, reasons: guard.reasons.join(','), source: 'ai' })
    }
    // Neutralize any injected RAG context delimiters before we build the prompt.
    const messages = rawMessages.map((m) => (m.role === 'user' ? { ...m, content: sanitize(m.content) } : m))
    const userContext = chatContext || ''

    const db = getDb()

    // Load module system prompt (and bump usage) if a module slug was supplied.
    let modulePrompt = ''
    let customSystemPrompt = ''
    if (moduleSlug) {
      const mod = (await db.select().from(aiModules).where(eq(aiModules.slug, moduleSlug)))[0]
      if (mod?.systemPrompt) modulePrompt = mod.systemPrompt
      await db.update(aiModules).set({ usageCount: (mod?.usageCount ?? 0) + 1 }).where(eq(aiModules.slug, moduleSlug))
    }
    if (!modulePrompt) {
      const row = (await db.select().from(siteSettings).where(eq(siteSettings.key, 'ai_system_prompt')))[0]
      customSystemPrompt = row?.value ?? ''
    }

    const isFA = locale === 'fa'
    const defaultSystemPrompt = isFA
      ? 'شما HBZ AI Platform هستید — پلتفرم هوش مصنوعی سازمانی HBZ Technology. متخصص در زیرساخت IT، شبکه، امنیت، ابر، و مشاوره فناوری. پاسخ‌ها را حرفه‌ای، ساختارمند، و مفید نگه دارید.'
      : 'You are HBZ AI Platform — the enterprise AI advisor of HBZ Technology. You are an expert in IT infrastructure, networking, cybersecurity, cloud, virtualization, and technology consulting. Provide professional, structured, and actionable responses.'
    const basePrompt = modulePrompt || customSystemPrompt || defaultSystemPrompt
    const systemPrompt = basePrompt + (userContext ? `\nUser context: ${userContext}` : '')

    try {
      const { reply, sources, provider } = await runCompletion({ messages, systemPrompt, useRag: true })
      logger.info('AI chat', { provider, locale })
      return NextResponse.json({ reply, sources })
    } catch (e) {
      if (e instanceof AiConfigError) {
        return NextResponse.json({ error: 'AI API key not configured' }, { status: 503 })
      }
      throw e
    }
  } catch (err) {
    logger.error('AI chat error', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      { error: 'AI service error. Please try again.' },
      { status: 503 },
    )
  }
}
