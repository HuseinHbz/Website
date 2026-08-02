import { describe, it, expect } from 'vitest'
import { chainOf, effectiveLevel, isOpAllowed, levelSatisfies, levelProvenance, resolveTree, validLevel } from '../engine'

describe('rbac tree engine (26.27 بند ۲)', () => {
  it('chainOf builds most-specific-first ancestry', () => {
    expect(chainOf('erp.finance.journal')).toEqual(['erp.finance.journal', 'erp.finance', 'erp'])
    expect(chainOf('erp')).toEqual(['erp'])
  })

  it('🌳 inheritance: node without explicit value takes the parent value', () => {
    expect(effectiveLevel({ erp: 'read' }, 'erp.finance.journal')).toBe('read')
    expect(effectiveLevel({ 'erp.finance': 'write' }, 'erp.finance.journal')).toBe('write')
  })

  it('🎯 most specific explicit wins (tab > module > workspace)', () => {
    expect(effectiveLevel({ erp: 'read', 'erp.finance': 'write' }, 'erp.finance')).toBe('write')
    expect(effectiveLevel({ erp: 'write', 'erp.finance': 'read', 'erp.finance.journal': 'write' }, 'erp.finance.journal')).toBe('write')
  })

  it('🚫 deny dominates: explicit none on ANY chain level kills the subtree — even specific write below', () => {
    expect(effectiveLevel({ 'erp.finance': 'none', 'erp.finance.journal': 'write' }, 'erp.finance.journal')).toBe('none')
    expect(effectiveLevel({ erp: 'none', 'erp.finance': 'write' }, 'erp.finance.reports')).toBe('none')
  })

  it('↩️ no explicit grant anywhere → null (legacy role behaviour, R5)', () => {
    expect(effectiveLevel({}, 'erp.finance.journal')).toBeNull()
    expect(effectiveLevel({ crm: 'write' }, 'erp.finance')).toBeNull()
  })

  it('levelSatisfies: read satisfied by read/write; write only by write; none never', () => {
    expect(levelSatisfies('read', 'read')).toBe(true)
    expect(levelSatisfies('write', 'read')).toBe(true)
    expect(levelSatisfies('read', 'write')).toBe(false)
    expect(levelSatisfies('write', 'write')).toBe(true)
    expect(levelSatisfies('none', 'read')).toBe(false)
  })

  it('sensitive op: write does NOT imply — explicit grant required; no row → null (legacy)', () => {
    expect(isOpAllowed({}, { 'erp.finance': 'write' }, 'erp.finance:post')).toBeNull()
    expect(isOpAllowed({ 'erp.finance:post': true }, { 'erp.finance': 'write' }, 'erp.finance:post')).toBe(true)
    expect(isOpAllowed({ 'erp.finance:post': false }, { 'erp.finance': 'write' }, 'erp.finance:post')).toBe(false)
  })

  it('sensitive op under a none subtree is denied even with an explicit op grant', () => {
    expect(isOpAllowed({ 'erp.finance:post': true }, { 'erp.finance': 'none' }, 'erp.finance:post')).toBe(false)
    expect(isOpAllowed({ 'erp.finance:post': true }, { erp: 'none' }, 'erp.finance:post')).toBe(false)
  })

  it('provenance reports where a level came from', () => {
    expect(levelProvenance({ erp: 'read' }, 'erp.finance')).toEqual({ level: 'read', source: 'erp', explicit: false })
    expect(levelProvenance({ 'erp.finance': 'write' }, 'erp.finance')).toEqual({ level: 'write', source: 'erp.finance', explicit: true })
    expect(levelProvenance({}, 'erp.finance')).toEqual({ level: null, source: null, explicit: false })
  })

  it('resolveTree resolves every key with provenance', () => {
    const t = resolveTree({ erp: 'read', 'erp.finance': 'none' }, ['erp', 'erp.finance', 'erp.finance.journal', 'crm'])
    expect(t.find(n => n.key === 'erp')!.level).toBe('read')
    expect(t.find(n => n.key === 'erp.finance.journal')!.level).toBe('none')
    expect(t.find(n => n.key === 'erp.finance.journal')!.source).toBe('erp.finance')
    expect(t.find(n => n.key === 'crm')!.level).toBeNull()
  })

  it('validLevel accepts only the three levels', () => {
    expect(validLevel('read')).toBe(true)
    expect(validLevel('admin')).toBe(false)
  })
})
