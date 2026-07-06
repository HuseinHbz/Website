import { describe, it, expect } from 'vitest'
import { summarize, type UsageRow } from '../analytics'

function row(p: Partial<UsageRow>): UsageRow {
  return {
    id: 1, ts: '2026-07-06 10:00:00', provider: 'chatgpt', model: 'gpt-4o', source: 'chat',
    latencyMs: 100, success: 1, error: null, inputTokens: 10, outputTokens: 20, ragSources: 0, feedback: 0,
    ...p,
  }
}

describe('AI analytics summarize', () => {
  it('handles an empty dataset without dividing by zero', () => {
    const s = summarize([])
    expect(s.totalCalls).toBe(0)
    expect(s.successRate).toBe(0)
    expect(s.avgLatencyMs).toBe(0)
    expect(s.byProvider).toEqual([])
  })

  it('computes success rate, tokens and latency', () => {
    const s = summarize([
      row({ id: 1, success: 1, latencyMs: 100, inputTokens: 10, outputTokens: 20 }),
      row({ id: 2, success: 0, latencyMs: 300, inputTokens: 5, outputTokens: 0, error: 'boom' }),
    ])
    expect(s.totalCalls).toBe(2)
    expect(s.successCalls).toBe(1)
    expect(s.failedCalls).toBe(1)
    expect(s.successRate).toBe(50)
    expect(s.avgLatencyMs).toBe(200)
    expect(s.totalTokens).toBe(35)
    expect(s.recentFailures[0].error).toBe('boom')
  })

  it('estimates cost from configured $/1k tokens', () => {
    const s = summarize([row({ inputTokens: 500, outputTokens: 500 })], { costPer1k: 2 })
    // 1000 tokens / 1000 * $2 = $2.00
    expect(s.estCostUsd).toBe(2)
  })

  it('breaks down by provider/model/source and computes RAG hit rate', () => {
    const s = summarize([
      row({ id: 1, provider: 'chatgpt', source: 'chat', ragSources: 2 }),
      row({ id: 2, provider: 'claude', source: 'agent:seo', ragSources: 0 }),
      row({ id: 3, provider: 'claude', source: 'agent:seo', ragSources: 1 }),
    ])
    expect(s.byProvider.find(b => b.key === 'claude')?.calls).toBe(2)
    expect(s.bySource.find(b => b.key === 'agent:seo')?.calls).toBe(2)
    expect(s.ragHitRate).toBeCloseTo(66.7, 1)
  })

  it('tallies thumbs up/down feedback', () => {
    const s = summarize([row({ feedback: 1 }), row({ feedback: 1 }), row({ feedback: -1 })])
    expect(s.thumbsUp).toBe(2)
    expect(s.thumbsDown).toBe(1)
  })

  it('buckets a daily series by date', () => {
    const s = summarize([
      row({ ts: '2026-07-05 09:00:00' }),
      row({ ts: '2026-07-06 09:00:00' }),
      row({ ts: '2026-07-06 11:00:00', success: 0 }),
    ], { days: 3650 })
    expect(s.daily).toHaveLength(2)
    const last = s.daily[s.daily.length - 1]
    expect(last.date).toBe('2026-07-06')
    expect(last.calls).toBe(2)
    expect(last.failures).toBe(1)
  })
})
