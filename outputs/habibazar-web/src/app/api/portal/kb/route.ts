/**
 * Portal knowledge base (Phase 26.25b بند ۱). Read-only help center that REUSES
 * ai_knowledge_base (NO new CMS) — only articles flagged portal_public=1 AND active
 * are exposed. Requires a valid portal session; supports a simple search. The
 * search term is the only bound parameter (parametrised ILIKE, no arbitrary SQL).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { pgQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  const id = Number(req.nextUrl.searchParams.get('id'))
  try {
    if (id) {
      const a = (await pgQuery(
        `SELECT id, title, content, type, tags, updated_at AS "updatedAt" FROM ai_knowledge_base
         WHERE id=$1 AND portal_public=1 AND active=true`, [id]))[0]
      if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ article: a })
    }
    const like = `%${q}%`
    const rows = await pgQuery(
      `SELECT id, title, type, tags, left(COALESCE(content,''),200) AS excerpt
       FROM ai_knowledge_base
       WHERE portal_public=1 AND active=true ${q ? 'AND (title ILIKE $1 OR content ILIKE $1 OR tags ILIKE $1)' : ''}
       ORDER BY priority DESC, updated_at DESC LIMIT 50`, q ? [like] : [])
    return NextResponse.json({ articles: rows })
  } catch { return NextResponse.json({ articles: [] }) }
}
