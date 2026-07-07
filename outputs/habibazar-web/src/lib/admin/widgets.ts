/**
 * Dashboard Widget registry (Phase 22.2).
 *
 * Pure metadata for every dashboard widget — no data, no I/O, no React (safe on
 * client + server). The server resolver (`widgetData.ts`) maps each widget id to
 * REAL data from existing module services; the client renders generically by
 * `category`. A widget belongs to a workspace and declares its size + optional
 * RBAC requirement. Each workspace's `defaultLayout` is the ordered list of
 * widget ids shown before a user customises + saves their own layout.
 */

export type WidgetCategory = 'kpi' | 'chart' | 'table' | 'list' | 'ops'
export type WidgetSize = 'sm' | 'md' | 'lg'
export type WidgetRequire = 'edit' | 'manage_settings' | 'manage_users'

export interface WidgetDef {
  id: string
  titleEn: string; titleFa: string
  category: WidgetCategory
  workspace: string
  size: WidgetSize
  requires?: WidgetRequire
  icon: string
}

export const WIDGETS: WidgetDef[] = [
  // Executive / ERP KPIs (finance)
  { id: 'kpi_net_income', titleEn: 'Net Income', titleFa: 'سود خالص', category: 'kpi', workspace: 'executive', size: 'sm', icon: '💰', requires: 'edit' },
  { id: 'kpi_cash', titleEn: 'Cash & Bank', titleFa: 'نقد و بانک', category: 'kpi', workspace: 'executive', size: 'sm', icon: '🏦', requires: 'edit' },
  { id: 'kpi_revenue', titleEn: 'Revenue', titleFa: 'درآمد', category: 'kpi', workspace: 'erp', size: 'sm', icon: '📈', requires: 'edit' },
  { id: 'kpi_inventory_value', titleEn: 'Inventory Value', titleFa: 'ارزش انبار', category: 'kpi', workspace: 'erp', size: 'sm', icon: '📦', requires: 'edit' },
  { id: 'kpi_active_assets', titleEn: 'Active Assets', titleFa: 'دارایی‌های فعال', category: 'kpi', workspace: 'erp', size: 'sm', icon: '🖧', requires: 'edit' },
  // CRM
  { id: 'kpi_crm_pipeline', titleEn: 'Open Pipeline', titleFa: 'خط لولهٔ باز', category: 'kpi', workspace: 'crm', size: 'sm', icon: '📇' },
  { id: 'kpi_crm_leads', titleEn: 'Total Leads', titleFa: 'کل سرنخ‌ها', category: 'kpi', workspace: 'crm', size: 'sm', icon: '🎯' },
  // AI
  { id: 'kpi_ai_calls', titleEn: 'AI Calls (30d)', titleFa: 'فراخوان هوش مصنوعی (۳۰ روز)', category: 'kpi', workspace: 'ai', size: 'sm', icon: '🤖' },
  { id: 'chart_ai_daily', titleEn: 'AI Usage Trend', titleFa: 'روند مصرف هوش مصنوعی', category: 'chart', workspace: 'ai', size: 'lg', icon: '📊' },
  // Data widgets (executive)
  { id: 'table_activity', titleEn: 'Recent Activity', titleFa: 'فعالیت اخیر', category: 'table', workspace: 'executive', size: 'lg', icon: '🕓' },
  { id: 'list_alerts', titleEn: 'Cross-Module Alerts', titleFa: 'هشدارهای بین‌ماژولی', category: 'list', workspace: 'executive', size: 'md', icon: '🔔' },
  // Operations
  { id: 'ops_system_health', titleEn: 'System Health', titleFa: 'سلامت سیستم', category: 'ops', workspace: 'operations', size: 'md', icon: '🖥️' },
  { id: 'ops_subsystems', titleEn: 'Subsystem Status', titleFa: 'وضعیت زیرسیستم‌ها', category: 'list', workspace: 'operations', size: 'md', icon: '🧩' },
  { id: 'ops_backup', titleEn: 'Backup Status', titleFa: 'وضعیت پشتیبان', category: 'ops', workspace: 'backup', size: 'sm', icon: '💾' },
]

export function widgetById(id: string): WidgetDef | undefined {
  return WIDGETS.find(w => w.id === id)
}

/** Widgets available to place on a given workspace's dashboard. */
export function widgetsForWorkspace(workspace: string): WidgetDef[] {
  // Executive can also host any widget; other workspaces show their own.
  if (workspace === 'executive') return WIDGETS
  return WIDGETS.filter(w => w.workspace === workspace)
}

export interface WidgetConfig { refreshInterval?: number; warn?: number; critical?: number }
export interface LayoutEntry { id: string; size: WidgetSize; config?: WidgetConfig }

/** Per-widget cache TTL (ms) — how long resolved data may be reused. */
export const WIDGET_TTL: Record<string, number> = {
  ops_system_health: 30_000, ops_subsystems: 30_000, ops_backup: 60_000,
}
export function widgetTtl(id: string): number {
  return WIDGET_TTL[id] ?? 300_000 // default 5 min (KPIs/charts/tables)
}

export type LayoutSource = 'user' | 'department' | 'role' | 'default'
/**
 * Resolve the effective layout by priority:
 *   user → department → role → workspace default.
 * Pure — the route supplies each persisted tier.
 */
export function pickLayout(
  workspace: string,
  user: LayoutEntry[] | null,
  dept: LayoutEntry[] | null,
  role: LayoutEntry[] | null,
): { layout: LayoutEntry[]; source: LayoutSource } {
  if (user && user.length) return { layout: sanitizeLayout(workspace, user), source: 'user' }
  if (dept && dept.length) return { layout: sanitizeLayout(workspace, dept), source: 'department' }
  if (role && role.length) return { layout: sanitizeLayout(workspace, role), source: 'role' }
  return { layout: defaultLayout(workspace), source: 'default' }
}

/** The system default layout for a workspace (ordered). */
export function defaultLayout(workspace: string): LayoutEntry[] {
  const preset: Record<string, string[]> = {
    executive: ['kpi_net_income', 'kpi_cash', 'kpi_crm_pipeline', 'kpi_ai_calls', 'list_alerts', 'table_activity'],
    erp: ['kpi_revenue', 'kpi_inventory_value', 'kpi_active_assets'],
    crm: ['kpi_crm_pipeline', 'kpi_crm_leads'],
    ai: ['kpi_ai_calls', 'chart_ai_daily'],
    operations: ['ops_system_health', 'ops_subsystems'],
    backup: ['ops_backup'],
  }
  const ids = preset[workspace] ?? widgetsForWorkspace(workspace).map(w => w.id)
  return ids.map(id => ({ id, size: widgetById(id)?.size ?? 'sm' }))
}

/** Keep only entries whose widget exists + belongs to the workspace (sanitises a saved layout). */
export function sanitizeLayout(workspace: string, layout: LayoutEntry[]): LayoutEntry[] {
  const allowed = new Set(widgetsForWorkspace(workspace).map(w => w.id))
  const seen = new Set<string>()
  return layout.filter(e => {
    if (!allowed.has(e.id) || seen.has(e.id)) return false
    seen.add(e.id)
    return true
  }).map(e => {
    const out: LayoutEntry = { id: e.id, size: (['sm', 'md', 'lg'] as const).includes(e.size) ? e.size : 'sm' }
    if (e.config) {
      const c: WidgetConfig = {}
      if (Number.isFinite(e.config.refreshInterval)) c.refreshInterval = Math.max(0, Math.min(3600, Number(e.config.refreshInterval)))
      if (Number.isFinite(e.config.warn)) c.warn = Number(e.config.warn)
      if (Number.isFinite(e.config.critical)) c.critical = Number(e.config.critical)
      if (Object.keys(c).length) out.config = c
    }
    return out
  })
}
