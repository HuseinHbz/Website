import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { runCompletion, AiConfigError } from '@/lib/ai/engine'
import { buildAssistPrompt, type AssistAction, type AssistTone, type AssistLocale } from '@/lib/hero/aiAssist'
import { recommendAnimations, recommendationRationale } from '@/lib/hero/recommend'
import type { HeroConfig } from '@/lib/hero/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const actionEnum = z.enum(['title', 'subtitle', 'cta', 'features', 'benefits', 'value-prop', 'seo-title', 'meta', 'keywords', 'faq', 'improve', 'rewrite', 'summarize', 'translate'])
const toneEnum = z.enum(['brand', 'professional', 'executive', 'technical', 'cybersecurity', 'cloud', 'ai'])

const contentSchema = z.object({
  kind: z.literal('content'),
  action: actionEnum,
  locale: z.enum(['en', 'fa']),
  tone: toneEnum.optional(),
  headline: z.string().max(400).optional(),
  subheadline: z.string().max(800).optional(),
  selection: z.string().max(4000).optional(),
  category: z.string().max(40).optional(),
  targetLocale: z.enum(['en', 'fa']).optional(),
})
const animSchema = z.object({
  kind: z.literal('animations'),
  config: z.record(z.string(), z.unknown()),
  device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  reduceMotion: z.boolean().optional(),
  locale: z.enum(['en', 'fa']).default('en'),
})
const body = z.discriminatedUnion('kind', [contentSchema, animSchema])

// POST — Hero AI assistant. Content generation dispatches through the SHARED AI
// engine (provider manager + RAG + telemetry). Animation suggestions are the
// deterministic recommendation engine (no LLM needed). RBAC-gated + audited.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, body)
  if ('error' in parsed) return parsed.error
  const d = parsed.data

  try {
    if (d.kind === 'animations') {
      const cfg = d.config as unknown as HeroConfig
      const animations = recommendAnimations(cfg, { device: d.device, reduceMotion: d.reduceMotion })
      await logAction(auth.user, 'hero.ai.recommend', 'heroes', '', { device: d.device })
      return NextResponse.json({ animations, rationale: recommendationRationale(cfg, d.locale) })
    }

    const { systemPrompt, userMessage } = buildAssistPrompt({
      action: d.action as AssistAction, locale: d.locale as AssistLocale, tone: d.tone as AssistTone | undefined,
      headline: d.headline, subheadline: d.subheadline, selection: d.selection, category: d.category, targetLocale: d.targetLocale,
    })
    const result = await runCompletion({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      useRag: false,
      source: `hero-assist:${d.action}`,
    })
    await logAction(auth.user, 'hero.ai.generate', 'heroes', '', { action: d.action, provider: result.provider })
    return NextResponse.json({ text: result.reply.trim(), provider: result.provider, usageId: result.usageId })
  } catch (e) {
    if (e instanceof AiConfigError) return NextResponse.json({ error: 'AI provider is not configured. Set it in AI settings.' }, { status: 400 })
    return apiError(e, 'AI assistant failed')
  }
}
