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

export interface LayoutEntry { id: string; size: WidgetSize }

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
  }).map(e => ({ id: e.id, size: (['sm', 'md', 'lg'] as const).includes(e.size) ? e.size : 'sm' }))
}
