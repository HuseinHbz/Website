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

  // First, fetch available models
  const modelsUrl = `${apiUrl || 'https://conduit.ozdoev.net/api/v1'}/models`
  let models: string[] = []
  try {
    const mRes = await fetch(modelsUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (mRes.ok) {
      const mData = await mRes.json() as { data: { id: string }[] }
      models = mData.data?.map((m) => m.id) ?? []
    }
  } catch { /* ignore */ }

  const url = `${apiUrl || 'https://conduit.ozdoev.net/api/v1'}/chat/completions`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        max_tokens: 10,
      }),
    })
    const body = await res.text()
    if (!res.ok) {
      return NextResponse.json({ ok: false, config, models, status: res.status, error: body })
    }
    const data = JSON.parse(body)
    return NextResponse.json({ ok: true, config, models, reply: data.choices?.[0]?.message?.content })
  } catch (e) {
    return NextResponse.json({ ok: false, config, models, error: String(e) })
  }
}
