/**
 * AI Financial Assistant (Phase 26) — prompt builder + deterministic pre-analysis.
 *
 * Reuses the SHARED AI Platform (`runCompletion`) — no second AI system. The
 * route injects a live, read-only finance snapshot into the system prompt (the
 * LLM never touches the DB), the same handler-seam pattern as the grounded AI
 * agents. The anomaly scan is deterministic and unit-tested; the LLM only adds
 * narrative on top of real numbers.
 */

export type FinanceAiAction = 'explain' | 'summarize' | 'analyze' | 'forecast'

export interface EntryFact { id: number; date: string; total: number; memo?: string | null }
export interface Anomaly { code: string; message: string; entryIds: number[] }

/** Deterministic anomaly scan over journal entries: duplicate totals on the same
 * day (possible double entry) and outliers > 5× the median total. */
export function scanAnomalies(entries: EntryFact[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  // Duplicates: same date + same total (≥ 2 entries).
  const byKey = new Map<string, number[]>()
  for (const e of entries) {
    const k = `${e.date}|${e.total}`
    byKey.set(k, [...(byKey.get(k) ?? []), e.id])
  }
  for (const [k, ids] of byKey) {
    if (ids.length >= 2 && Number(k.split('|')[1]) > 0)
      anomalies.push({ code: 'duplicate.total', message: `${ids.length} entries share date ${k.split('|')[0]} and total ${Number(k.split('|')[1]).toLocaleString()} — possible duplicate.`, entryIds: ids })
  }
  // Outliers: > 5× median of positive totals (needs ≥ 4 samples to be meaningful).
  const totals = entries.map(e => e.total).filter(t => t > 0).sort((a, b) => a - b)
  if (totals.length >= 4) {
    const median = totals[Math.floor(totals.length / 2)]
    for (const e of entries) {
      if (median > 0 && e.total > median * 5)
        anomalies.push({ code: 'outlier.total', message: `Entry ${e.id} total ${e.total.toLocaleString()} is more than 5× the median (${median.toLocaleString()}).`, entryIds: [e.id] })
    }
  }
  return anomalies
}

const ACTION_TASK: Record<FinanceAiAction, string> = {
  explain: 'Explain the requested accounting concept or entry in plain language, referencing the double-entry principle where helpful.',
  summarize: 'Summarize the financial position from the snapshot: profitability, liquidity, payables pressure. 4-6 tight sentences.',
  analyze: 'Analyze the books for risks: anomalies listed below, expense concentration, unusual balances. Be specific; cite the numbers given.',
  forecast: 'Comment on the near-term cash outlook using the receivables/payables and net income in the snapshot. State assumptions explicitly.',
}

/** Build the grounded system + user prompt for the finance assistant. */
export function buildFinancePrompt(
  action: FinanceAiAction,
  snapshot: string,
  opts: { question?: string; locale?: 'en' | 'fa'; anomalies?: Anomaly[] } = {},
): { systemPrompt: string; userMessage: string } {
  const lang = opts.locale === 'fa' ? 'Persian (فارسی)' : 'English'
  const systemPrompt = [
    'You are the AI Financial Assistant of the HBZ ERP. You advise on the company books.',
    `Answer in ${lang}.`,
    'GROUNDING RULES: Use ONLY the live snapshot below. Never invent figures, accounts or transactions.',
    'If the snapshot lacks the data needed, say so plainly.',
    '--- LIVE FINANCE SNAPSHOT (read-only) ---',
    snapshot,
    opts.anomalies?.length ? `--- DETECTED ANOMALIES ---\n${opts.anomalies.map(a => `- ${a.message}`).join('\n')}` : '',
    '--- END SNAPSHOT ---',
  ].filter(Boolean).join('\n')
  const userMessage = [ACTION_TASK[action], opts.question ? `Question: ${opts.question}` : ''].filter(Boolean).join('\n\n')
  return { systemPrompt, userMessage }
}
