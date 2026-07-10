import { describe, it, expect } from 'vitest'
import { cosineSim, blendScores, normalize } from '../embeddings'

describe('embeddings math', () => {
  it('cosineSim: identical=1, orthogonal=0, degenerate=0', () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1, 6)
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 6)
    expect(cosineSim([], [])).toBe(0)
    expect(cosineSim([1, 2], [1])).toBe(0)
    expect(cosineSim([0, 0], [1, 1])).toBe(0)
  })
  it('blendScores weights semantic by default 0.6 and clamps the weight', () => {
    expect(blendScores(1, 0)).toBeCloseTo(0.4, 6)
    expect(blendScores(0, 1)).toBeCloseTo(0.6, 6)
    expect(blendScores(1, 1, 5)).toBe(1)
  })
  it('normalize maps to 0..1 against the batch max (all-zero stays zero)', () => {
    expect(normalize([2, 4, 0])).toEqual([0.5, 1, 0])
    expect(normalize([0, 0])).toEqual([0, 0])
  })
})
