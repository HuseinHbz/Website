import { describe, it, expect } from 'vitest'
import { extractVariables, renderPrompt, missingVariables, isUsable } from '../prompts'

describe('Prompt Center helpers', () => {
  it('extracts distinct variables in first-seen order', () => {
    expect(extractVariables('Hi {{name}}, your {{plan}} — {{name}} again')).toEqual(['name', 'plan'])
    expect(extractVariables('no vars here')).toEqual([])
    expect(extractVariables('spaced {{ x }}')).toEqual(['x'])
  })

  it('renders known variables and leaves unknown ones intact', () => {
    expect(renderPrompt('Hi {{name}}', { name: 'Ali' })).toBe('Hi Ali')
    expect(renderPrompt('Hi {{name}} {{missing}}', { name: 'Ali' })).toBe('Hi Ali {{missing}}')
  })

  it('reports missing variables (unset or empty)', () => {
    expect(missingVariables('{{a}} {{b}}', { a: 'x' })).toEqual(['b'])
    expect(missingVariables('{{a}}', { a: '' })).toEqual(['a'])
    expect(missingVariables('{{a}}', { a: 'x' })).toEqual([])
  })

  it('only treats an approved, non-empty prompt as usable', () => {
    expect(isUsable('approved', 'body')).toBe(true)
    expect(isUsable('approved', '   ')).toBe(false)
    expect(isUsable('draft', 'body')).toBe(false)
    expect(isUsable('archived', 'body')).toBe(false)
  })
})
