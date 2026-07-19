/**
 * CRM dashboard data (Phase 26.25b بند ۲). REUSES the verified module engines —
 * pipelineStats (leads funnel), agingBuckets (AR), campaign per-channel analytics,
 * ticket SLA — and adds month-over-month deltas. No duplicated aggregation.
 */
import { pgQuery } from '@/lib/db'
import { pipelineStats, type LeadStatus } from './leads'
import { agingBuckets, type OpenInvoiceFact } from './aging'
import { momChange, monthBounds, type MoM } from './dashboard'

const num = (v: unknown) => Number(v ?? 0)

export interface CrmDashboard {
  funnel: ReturnType<typeof pipelineStats>
  noActivityLeads: number
  openTickets: number
  breachedTickets: number
  aging: ReturnType<typeof agingBuckets>
  arBalance: number
  channels: { channel: string; sent: number; delivered: number; leads: number; won: number; spend: number }[]
  mom: { newLeads: MoM; wonValue: MoM; newTickets: MoM; newCustomers: MoM }
}

export async function crmDashboard(slaDaysNoActivity = 7): Promise<CrmDashboard> {
  const b = monthBounds(new Date())

  // Funnel — reuse pipelineStats over all leads.
  const leads = await pgQuery<{ status: LeadStatus; value: number; score: number }>(
    `SELECT status, value::float AS value, score FROM crm_leads WHERE converted_customer_id IS NULL OR status IN ('won','lost')`)
  const funnel = pipelineStats(leads.map(l => ({ status: l.status, value: num(l.value), score: num(l.score) })))

  // No-activity leads: open leads with no activity within N days.
  const noActivity = (await pgQuery<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM crm_leads l
     WHERE l.status IN ('new','contacted','qualified','proposal')
       AND NOT EXISTS (SELECT 1 FROM crm_activities a WHERE a.lead_id=l.id AND a.created_at > to_char(now() - ($1||' days')::interval,'YYYY-MM-DD HH24:MI:SS'))`,
    [String(slaDaysNoActivity)]))[0]?.c ?? 0

  // Tickets — reuse the same status/SLA fields.
  const openTickets = (await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM crm_tickets WHERE status IN ('new','open','pending')`))[0]?.c ?? 0
  const breachedTickets = (await pgQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM business_alerts WHERE kind='ticket_sla_breach' AND status<>'resolved'`))[0]?.c ?? 0

  // AR aging — reuse agingBuckets over all open invoices.
  const openInv = await pgQuery<{ total: number; paid: number; due: string | null; date: string }>(
    `SELECT d.total::float AS total, COALESCE((SELECT SUM(amount) FROM sales_payments p WHERE p.document_id=d.id),0)::float AS paid,
            d.due_date AS due, d.date
     FROM sales_documents d WHERE d.doc_type='invoice' AND d.status NOT IN ('void','draft') AND d.deleted_at IS NULL`)
  const facts: OpenInvoiceFact[] = openInv.map(r => ({ outstanding: num(r.total) - num(r.paid), dueDate: (r.due || r.date || '').slice(0, 10) })).filter(f => f.outstanding > 0.001)
  const aging = agingBuckets(facts, new Date().toISOString().slice(0, 10))
  const arBalance = Math.round(facts.reduce((s, f) => s + f.outstanding, 0) * 100) / 100

  // Per-channel campaign performance (reuse the recipient delivery + attribution).
  const channels = await pgQuery<{ channel: string; sent: number; delivered: number; leads: number; won: number; spend: number }>(
    `SELECT r.channel,
            COUNT(*) FILTER (WHERE r.status IN ('sent','delivered','read'))::int AS sent,
            COUNT(*) FILTER (WHERE r.delivered_at IS NOT NULL)::int AS delivered,
            COUNT(DISTINCT l.id)::int AS leads,
            COUNT(DISTINCT l.id) FILTER (WHERE l.status='won')::int AS won,
            COALESCE(SUM(c.cost),0)::float AS spend
     FROM crm_campaign_recipients r
     JOIN crm_campaigns c ON c.id=r.campaign_id
     LEFT JOIN crm_leads l ON l.campaign_id=c.id
     GROUP BY r.channel ORDER BY sent DESC`)

  // MoM deltas.
  const count = async (sql: string, from: string, to: string) => num((await pgQuery<{ c: number }>(sql, [from, to]))[0]?.c)
  const sum = async (sql: string, from: string, to: string) => num((await pgQuery<{ s: number }>(sql, [from, to]))[0]?.s)
  const newLeads = momChange(
    await count(`SELECT COUNT(*)::int AS c FROM crm_leads WHERE created_at>=$1 AND created_at<$2`, b.curStart, '9999'),
    await count(`SELECT COUNT(*)::int AS c FROM crm_leads WHERE created_at>=$1 AND created_at<$2`, b.prevStart, b.prevEnd))
  const wonValue = momChange(
    await sum(`SELECT COALESCE(SUM(value),0)::float AS s FROM crm_leads WHERE status='won' AND updated_at>=$1 AND updated_at<$2`, b.curStart, '9999'),
    await sum(`SELECT COALESCE(SUM(value),0)::float AS s FROM crm_leads WHERE status='won' AND updated_at>=$1 AND updated_at<$2`, b.prevStart, b.prevEnd))
  const newTickets = momChange(
    await count(`SELECT COUNT(*)::int AS c FROM crm_tickets WHERE created_at>=$1 AND created_at<$2`, b.curStart, '9999'),
    await count(`SELECT COUNT(*)::int AS c FROM crm_tickets WHERE created_at>=$1 AND created_at<$2`, b.prevStart, b.prevEnd))
  const newCustomers = momChange(
    await count(`SELECT COUNT(*)::int AS c FROM sales_customers WHERE created_at>=$1 AND created_at<$2`, b.curStart, '9999'),
    await count(`SELECT COUNT(*)::int AS c FROM sales_customers WHERE created_at>=$1 AND created_at<$2`, b.prevStart, b.prevEnd))

  return { funnel, noActivityLeads: noActivity, openTickets, breachedTickets, aging, arBalance, channels, mom: { newLeads, wonValue, newTickets, newCustomers } }
}
