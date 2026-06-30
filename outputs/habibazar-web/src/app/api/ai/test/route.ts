import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function getSetting(key: string): string {
  const db = getDb()
  const row = db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()
  return row?.value ?? ''
}

export async function GET() {
  const provider = getSetting('ai_provider') || 'chatgpt'
  const apiKey = getSetting('ai_api_key')
  const model = getSetting('ai_model')
  const apiUrl = getSetting('ai_api_url')

  const config = { provider, model, apiUrl, hasKey: !!apiKey, keyPrefix: apiKey.slice(0, 10) + '...' }

  if (!apiKey) {
    return NextResponse.json({ ok: false, config, error: 'No API key configured' })
  }

  // Fetch available models
  const baseUrl = apiUrl || 'https://conduit.ozdoev.net/api/v1'
  let models: string[] = []
  try {
    const mRes = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (mRes.ok) {
      const mData = await mRes.json() as { data: { id: string }[] }
      models = mData.data?.map((m) => m.id) ?? []
    }
  } catch { /* ignore */ }

  const testModel = model || 'claude-sonnet-4-6'
  const isClaudeOnConduit = provider === 'conduit' && testModel.startsWith('claude')

  if (isClaudeOnConduit) {
    // Use Anthropic Messages endpoint for Claude models on Conduit
    const url = 'https://conduit.ozdoev.net/v1/messages'
    const requestBody = {
      model: testModel,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Reply with exactly the word: ok' }],
      max_tokens: 50,
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      const rawBody = await res.text()
      if (!res.ok) {
        return NextResponse.json({ ok: false, config, models, status: res.status, error: rawBody, sentRequest: requestBody, endpoint: url })
      }
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(rawBody) } catch {
        return NextResponse.json({ ok: false, config, models, error: 'Invalid JSON', rawBody, sentRequest: requestBody })
      }
      const reply = (parsed.content as { text: string }[])?.[0]?.text
      return NextResponse.json({ ok: true, config, models, reply, rawBody: parsed, sentRequest: requestBody, endpoint: url })
    } catch (e) {
      return NextResponse.json({ ok: false, config, models, error: String(e), sentRequest: requestBody })
    }
  }

  // OpenAI-compatible endpoint for non-Claude models
  const requestBody = {
    model: testModel,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Reply with exactly the word: ok' },
    ],
    max_tokens: 50,
  }
  const url = `${baseUrl}/chat/completions`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    const rawBody = await res.text()
    if (!res.ok) {
      return NextResponse.json({ ok: false, config, models, status: res.status, error: rawBody, sentRequest: requestBody })
    }
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(rawBody) } catch {
      return NextResponse.json({ ok: false, config, models, error: 'Invalid JSON', rawBody, sentRequest: requestBody })
    }
    const reply = (parsed.choices as { message: { content: string } }[])?.[0]?.message?.content
    return NextResponse.json({ ok: true, config, models, reply, rawBody: parsed, sentRequest: requestBody })
  } catch (e) {
    return NextResponse.json({ ok: false, config, models, error: String(e), sentRequest: requestBody })
  }
}
