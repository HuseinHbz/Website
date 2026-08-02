import { NextResponse } from 'next/server'
import { apiError, requirePermission } from '@/lib/api/respond'
import { syncKnowledgeFromCms } from '@/lib/ai/sync'
import { logAction } from '@/lib/admin/audit'

// Manual CMS → AI knowledge-base synchronization. Idempotent: upserts published
// content and prunes orphaned entries. Automatic sync also runs (debounced) on
// content edits via audit.logAction.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await requirePermission('ai.ai-kb', 'write', 'manage_settings')
    if ('error' in auth) return auth.error
    const result = await syncKnowledgeFromCms(auth.user.id)
    await logAction(auth.user, 'SYNC', 'ai_knowledge_base', undefined, undefined, result)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return apiError(e)
  }
}
