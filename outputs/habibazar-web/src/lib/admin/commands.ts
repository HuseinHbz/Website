/**
 * Command Registry (Phase 22.4).
 *
 * A centralized, pure registry of admin commands for the command palette. Two
 * kinds: `navigate` (open a page/workspace) and `execute` (POST a real backend
 * endpoint — no fake actions; every executable command maps to an endpoint that
 * exists). Navigation/module commands are derived elsewhere from the workspace
 * registry (single source of truth); this registry holds the *executable* actions
 * and a few global navigations, each RBAC-gated. No React, no I/O → unit-tested.
 */
import { roleCan, type WorkspaceRequire } from './workspaces'

export type CommandKind = 'navigate' | 'execute'
export interface Command {
  id: string
  titleEn: string; titleFa: string
  icon: string
  category: 'action' | 'navigate'
  requires?: WorkspaceRequire
  keywords: string
  kind: CommandKind
  href?: string
  endpoint?: string
  confirmEn?: string; confirmFa?: string
}

export const COMMANDS: Command[] = [
  // Executable actions — each targets a real, existing endpoint.
  {
    id: 'run_backup', titleEn: 'Run Backup Now', titleFa: 'اجرای پشتیبان‌گیری', icon: '💾',
    category: 'action', requires: 'manage_settings', keywords: 'backup snapshot run dr recovery',
    kind: 'execute', endpoint: '/api/admin/backup/run',
    confirmEn: 'Start a backup now?', confirmFa: 'پشتیبان‌گیری اکنون شروع شود؟',
  },
  {
    id: 'sync_ai_kb', titleEn: 'Sync AI Knowledge Base', titleFa: 'همگام‌سازی پایگاه دانش هوش مصنوعی', icon: '📚',
    category: 'action', requires: 'manage_settings', keywords: 'ai knowledge rag sync rebuild index kb',
    kind: 'execute', endpoint: '/api/admin/ai-kb/sync',
    confirmEn: 'Re-sync the AI knowledge base from published content?', confirmFa: 'پایگاه دانش از محتوای منتشرشده همگام شود؟',
  },
  // Global navigations (quick jumps that aren't a single sidebar item).
  { id: 'open_search', titleEn: 'Global Search', titleFa: 'جستجوی سراسری', icon: '🔍', category: 'navigate', keywords: 'search find everything', kind: 'navigate', href: '/admin/search' },
  { id: 'open_home', titleEn: 'All Workspaces', titleFa: 'همه فضاهای کاری', icon: '▦', category: 'navigate', keywords: 'workspaces home launcher grid', kind: 'navigate', href: '/admin/home' },
  { id: 'open_docs', titleEn: 'Documentation', titleFa: 'مستندات', icon: '📖', category: 'navigate', keywords: 'docs documentation guide api', kind: 'navigate', href: '/admin/docs' },
]

/** Commands a role may run/see (RBAC), optionally filtered by a query. */
export function visibleCommands(role: string, query = ''): Command[] {
  const q = query.trim().toLowerCase()
  return COMMANDS
    .filter(c => !c.requires || roleCan(role, c.requires))
    .filter(c => !q || c.titleEn.toLowerCase().includes(q) || c.titleFa.includes(query.trim()) || c.keywords.includes(q))
}
