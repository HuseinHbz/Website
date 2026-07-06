import { describe, it, expect } from 'vitest'
import { AGENTS, listAgents, getAgent, buildAgentRun } from '../agents'

describe('AI agents registry', () => {
  it('exposes a non-empty catalog with unique ids', () => {
    expect(AGENTS.length).toBeGreaterThan(0)
    const ids = AGENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every agent is fully bilingual and has a system prompt + examples', () => {
    for (const a of AGENTS) {
      expect(a.nameEn.trim()).not.toBe('')
      expect(a.nameFa.trim()).not.toBe('')
      expect(a.descEn.trim()).not.toBe('')
      expect(a.descFa.trim()).not.toBe('')
      expect(a.systemPrompt.length).toBeGreaterThan(40)
      expect(a.examplesEn.length).toBeGreaterThan(0)
      expect(a.examplesFa.length).toBe(a.examplesEn.length)
    }
  })

  it('every system prompt carries the anti-fabrication guardrail', () => {
    for (const a of AGENTS) {
      expect(a.systemPrompt.toLowerCase()).toContain('never invent')
    }
  })

  it('listAgents filters by category', () => {
    const sec = listAgents('security')
    expect(sec.length).toBeGreaterThan(0)
    expect(sec.every(a => a.category === 'security')).toBe(true)
    expect(listAgents().length).toBe(AGENTS.length)
  })

  it('getAgent resolves known ids and returns undefined otherwise', () => {
    expect(getAgent('seo')?.category).toBe('seo')
    expect(getAgent('does-not-exist')).toBeUndefined()
  })

  it('buildAgentRun composes the agent prompt with the task as a single user turn', () => {
    const agent = getAgent('crm')!
    const run = buildAgentRun(agent, 'score this lead')
    expect(run.systemPrompt).toBe(agent.systemPrompt)
    expect(run.messages).toEqual([{ role: 'user', content: 'score this lead' }])
  })
})
