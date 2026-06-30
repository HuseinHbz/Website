import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiConversations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const db = getDb()
  if (id) {
    const row = db.select().from(aiConversations).where(eq(aiConversations.id, id)).get()
    return NextResponse.json(row || null)
  }
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')
  const rows = db.select().from(aiConversations).orderBy(desc(aiConversations.updatedAt)).limit(limit).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { id: string; moduleSlug?: string; titleEn?: string; locale?: string; messagesJson: string; sourcesJson?: string }
  const db = getDb()
  db.insert(aiConversations).values({
    id: body.id,
    moduleSlug: body.moduleSlug,
    titleEn: body.titleEn,
    locale: body.locale || 'en',
    messagesJson: body.messagesJson,
    sourcesJson: body.sourcesJson || '[]',
  }).onConflictDoUpdate({
    target: aiConversations.id,
    set: {
      messagesJson: body.messagesJson,
      sourcesJson: body.sourcesJson || '[]',
      titleEn: body.titleEn,
      updatedAt: new Date().toISOString(),
    },
  }).run()
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { id: string; bookmarked?: boolean }
  const db = getDb()
  db.update(aiConversations).set({ bookmarked: body.bookmarked }).where(eq(aiConversations.id, body.id)).run()
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  const db = getDb()
  db.delete(aiConversations).where(eq(aiConversations.id, id)).run()
  return NextResponse.json({ ok: true })
}
