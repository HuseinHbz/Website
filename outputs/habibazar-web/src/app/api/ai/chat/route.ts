import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function getSetting(db: ReturnType<typeof getDb>, key: string): string {
  const row = db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()
  return row?.value ?? ''
}

async function callChatGPT(apiKey: string, apiUrl: string, model: string, messages: unknown[], systemPrompt: string) {
  const url = `${apiUrl}/chat/completions`
  const body = {
    model: model || 'gpt-4o',
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
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
  const authHeader = useBearer
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
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }
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
  // Grok uses OpenAI-compatible API
  return callChatGPT(apiKey, apiUrl, model || 'grok-beta', messages, systemPrompt)
}

export async function POST(req: NextRequest) {
  try {
    const { messages, locale, chatContext } = await req.json() as { messages: { role: string; content: string }[]; locale?: string; chatContext?: string }
    const userContext = chatContext || ''

    const db = getDb()
    const provider = getSetting(db, 'ai_provider') || 'chatgpt'
    const apiKey = getSetting(db, 'ai_api_key')
    const model = getSetting(db, 'ai_model')
    const apiUrl = getSetting(db, 'ai_api_url')
    const customSystemPrompt = getSetting(db, 'ai_system_prompt')

    if (!apiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 503 })
    }

    const isFA = locale === 'fa'
    const defaultSystemPrompt = isFA
      ? 'شما دستیار هوشمند HBZ هستید. به سوالات کاربران درباره خدمات زیرساخت شبکه، امنیت، و مشاوره حسین حبیب‌آذر پاسخ دهید. پاسخ‌ها را کوتاه و مفید نگه دارید.'
      : 'You are the HBZ AI assistant. Help users with questions about network infrastructure services, security, and consultations by Husein Habibazar. Keep responses concise and helpful.'
    const basePrompt = customSystemPrompt || defaultSystemPrompt
    const systemPrompt = userContext ? `${basePrompt}\n\nUser info: ${userContext}` : basePrompt

    let reply = ''

    switch (provider) {
      case 'claude':
        reply = await callClaude(apiKey, apiUrl || 'https://api.anthropic.com/v1', model, messages, systemPrompt)
        break
      case 'gemini':
        reply = await callGemini(apiKey, apiUrl || 'https://generativelanguage.googleapis.com/v1beta', model, messages, systemPrompt)
        break
      case 'grok':
        reply = await callGrok(apiKey, apiUrl || 'https://api.x.ai/v1', model, messages, systemPrompt)
        break
      case 'copilot':
        reply = await callChatGPT(apiKey, apiUrl || 'https://api.github.com/copilot', model, messages, systemPrompt)
        break
      case 'conduit': {
        const conduitModel = model || 'claude-sonnet-4-6'
        // Claude models: use Anthropic Messages endpoint (system field works correctly)
        // Other models: use OpenAI-compatible endpoint
        if (conduitModel.startsWith('claude')) {
          // Conduit Anthropic endpoint uses Bearer auth (not x-api-key)
          reply = await callClaude(apiKey, 'https://conduit.ozdoev.net/v1', conduitModel, messages, systemPrompt, true)
        } else {
          reply = await callChatGPT(apiKey, apiUrl || 'https://conduit.ozdoev.net/api/v1', conduitModel, messages, systemPrompt)
        }
        break
      }
      default: // chatgpt
        reply = await callChatGPT(apiKey, apiUrl || 'https://api.openai.com/v1', model, messages, systemPrompt)
        break
    }

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 },
    )
  }
}
