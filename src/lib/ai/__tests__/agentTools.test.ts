import { describe, it, expect } from 'vitest'
import { hasTool, AGENT_TOOLS } from '../agentTools'

describe('AI agent tools registry', () => {
  it('marks data-backed agents as having a live tool', () => {
    for (const id of ['crm', 'erp', 'security', 'backup', 'infrastructure']) {
      expect(hasTool(id)).toBe(true)
      expect(AGENT_TOOLS[id]).toBeTruthy()
    }
  })
  it('leaves purely generative agents without a tool', () => {
    for (const id of ['content', 'seo', 'sales', 'marketing', 'hr', 'unknown']) {
      expect(hasTool(id)).toBe(false)
    }
  })
})
