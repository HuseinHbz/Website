/**
 * Hero AI Content Assistant — prompt builder (Phase 25.1), pure & unit-tested.
 *
 * Turns an assistant action + context into a { systemPrompt, userMessage } pair
 * for the SHARED AI engine (`runCompletion`). No provider logic here — the route
 * dispatches through the existing AI Platform (provider manager, RAG, telemetry,
 * prompt versioning). Keeps the assistant honest: every field it can produce is
 * an editable text suggestion, never an automatic write.
 */

export type AssistAction =
  | 'title' | 'subtitle' | 'cta' | 'features' | 'benefits' | 'value-prop'
  | 'seo-title' | 'meta' | 'keywords' | 'faq'
  | 'improve' | 'rewrite' | 'summarize' | 'translate'

export type AssistTone =
  | 'brand' | 'professional' | 'executive' | 'technical'
  | 'cybersecurity' | 'cloud' | 'ai'

export type AssistLocale = 'en' | 'fa'

export interface AssistContext {
  action: AssistAction
  locale: AssistLocale
  tone?: AssistTone
  /** Current hero content for context / the text to transform. */
  headline?: string
  subheadline?: string
  selection?: string
  /** Template category for domain framing (e.g. 'security', 'ai'). */
  category?: string
  /** For translate: the target language. */
  targetLocale?: AssistLocale
}

const TONE_DESC: Record<AssistTone, string> = {
  brand: 'on-brand, confident and human',
  professional: 'professional and clear',
  executive: 'concise, executive, outcome-focused',
  technical: 'precise and technically credible',
  cybersecurity: 'security-authoritative, trust-building',
  cloud: 'modern cloud-native and scalable',
  ai: 'intelligent, forward-looking, AI-native',
}

const ACTION_TASK: Record<AssistAction, string> = {
  title: 'Write ONE compelling hero headline (H1), max 70 characters. Return only the headline text.',
  subtitle: 'Write ONE supporting subheadline, max 160 characters. Return only the subheadline text.',
  cta: 'Suggest 2 call-to-action button labels, max 24 characters each, one per line. Return only the labels.',
  features: 'List 3–5 concise product/service feature bullets, one per line, no numbering.',
  benefits: 'List 3–5 outcome-focused benefit bullets, one per line, no numbering.',
  'value-prop': 'Write ONE crisp value proposition sentence. Return only the sentence.',
  'seo-title': 'Write an SEO page title, 50–60 characters, keyword-rich. Return only the title.',
  meta: 'Write an SEO meta description, 140–160 characters. Return only the description.',
  keywords: 'Return 8–12 relevant SEO keywords as a single comma-separated line.',
  faq: 'Write 3 concise FAQ question/answer pairs. Format each as "Q: …\\nA: …".',
  improve: 'Improve the provided text for clarity and impact while preserving meaning. Return only the improved text.',
  rewrite: 'Rewrite the provided text with fresh wording, same intent. Return only the rewritten text.',
  summarize: 'Summarize the provided text into one tight sentence. Return only the summary.',
  translate: 'Translate the provided text faithfully. Return only the translation.',
}

/** Build the system + user messages for an assistant action. */
export function buildAssistPrompt(ctx: AssistContext): { systemPrompt: string; userMessage: string } {
  const langName = (l: AssistLocale) => (l === 'fa' ? 'Persian (فارسی)' : 'English')
  const outLocale = ctx.action === 'translate' ? (ctx.targetLocale ?? (ctx.locale === 'fa' ? 'en' : 'fa')) : ctx.locale
  const tone = ctx.tone ? TONE_DESC[ctx.tone] : 'professional and clear'

  const systemPrompt = [
    'You are the Hero Content Assistant for HBZ Technology, an enterprise infrastructure & security brand.',
    `Write in ${langName(outLocale)}.`,
    `Tone: ${tone}.`,
    ctx.category ? `The hero is for a "${ctx.category}" landing experience.` : '',
    'Never invent statistics, certifications, client names or facts. If unsure, stay general.',
    'Return ONLY the requested text — no preamble, no markdown fences, no explanation.',
  ].filter(Boolean).join(' ')

  const contextLines = [
    ctx.headline ? `Current headline: ${ctx.headline}` : '',
    ctx.subheadline ? `Current subheadline: ${ctx.subheadline}` : '',
    ctx.selection ? `Text to work on: ${ctx.selection}` : '',
  ].filter(Boolean).join('\n')

  const userMessage = [ACTION_TASK[ctx.action], contextLines].filter(Boolean).join('\n\n')
  return { systemPrompt, userMessage }
}
