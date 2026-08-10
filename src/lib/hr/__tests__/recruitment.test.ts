import { describe, it, expect } from 'vitest'
import { canTransition, isTerminalStage, STAGE_LABELS, APPLICATION_STAGES } from '../recruitment'

describe('recruitment stage machine', () => {
  it('every stage has both fa and en labels', () => {
    for (const s of APPLICATION_STAGES) {
      expect(STAGE_LABELS[s].en).toBeTruthy()
      expect(STAGE_LABELS[s].fa).toBeTruthy()
    }
  })

  it('allows the next sequential stage only', () => {
    expect(canTransition('screening', 'interview_1')).toBe(true)
    expect(canTransition('interview_1', 'interview_2')).toBe(true)
    expect(canTransition('interview_2', 'offer')).toBe(true)
    expect(canTransition('offer', 'hired')).toBe(true)
  })

  it('refuses skipping a stage', () => {
    expect(canTransition('screening', 'offer')).toBe(false)
    expect(canTransition('screening', 'hired')).toBe(false)
  })

  it('any live stage may move to rejected', () => {
    expect(canTransition('screening', 'rejected')).toBe(true)
    expect(canTransition('interview_2', 'rejected')).toBe(true)
    expect(canTransition('offer', 'rejected')).toBe(true)
  })

  it('a terminal stage accepts no further transition', () => {
    expect(isTerminalStage('hired')).toBe(true)
    expect(isTerminalStage('rejected')).toBe(true)
    expect(canTransition('hired', 'rejected')).toBe(false)
    expect(canTransition('rejected', 'screening')).toBe(false)
  })

  it('refuses a backward move', () => {
    expect(canTransition('interview_2', 'interview_1')).toBe(false)
    expect(canTransition('offer', 'screening')).toBe(false)
  })
})
