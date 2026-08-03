/**
 * 26.33 بند ۱.۳ — the assistant answered English inside the Persian UI.
 *
 * The defect was not a weak prompt: `modulePrompt || customPrompt || default`
 * meant the language instruction (which lived only in the default) was skipped
 * entirely whenever an advisor or a custom admin prompt was in play. These
 * tests assert the structural fix across all three prompt paths — the exact
 * three the spec required to be covered.
 */
import { describe, it, expect } from 'vitest'
import { languageDirective, buildSystemPrompt } from '../language'

const MODULE_PROMPT = 'You are the HBZ data-centre advisor.'
const CUSTOM_PROMPT = 'Answer as a concise enterprise consultant.'
const DEFAULT_PROMPT = 'شما HBZ AI Platform هستید.'

describe('languageDirective', () => {
  it('instructs Persian for the fa locale', () => {
    expect(languageDirective('fa')).toMatch(/Always answer in Persian/)
  })
  it('instructs English for the en locale', () => {
    expect(languageDirective('en')).toMatch(/Always answer in English/)
  })
  it('falls back to English when the locale is missing', () => {
    expect(languageDirective(undefined)).toMatch(/Always answer in English/)
  })
  it('declares itself higher priority than the prompt above it', () => {
    expect(languageDirective('fa')).toMatch(/overrides any instruction above/)
  })
  it('still defers to the user writing in another language', () => {
    expect(languageDirective('fa')).toMatch(/if the user writes to you in another language/)
  })
})

describe('buildSystemPrompt — all three prompt paths carry the fa rule', () => {
  it('module prompt (an advisor is selected)', () => {
    const p = buildSystemPrompt(MODULE_PROMPT, 'fa')
    expect(p).toContain(MODULE_PROMPT)
    expect(p).toMatch(/Always answer in Persian/)
  })
  it('custom admin prompt (ai_system_prompt is set)', () => {
    const p = buildSystemPrompt(CUSTOM_PROMPT, 'fa')
    expect(p).toContain(CUSTOM_PROMPT)
    expect(p).toMatch(/Always answer in Persian/)
  })
  it('default prompt (nothing configured)', () => {
    const p = buildSystemPrompt(DEFAULT_PROMPT, 'fa')
    expect(p).toContain(DEFAULT_PROMPT)
    expect(p).toMatch(/Always answer in Persian/)
  })

  it('an operator prompt cannot displace the rule — it comes after', () => {
    const p = buildSystemPrompt('Always reply in English.', 'fa')
    expect(p.indexOf('Always reply in English.')).toBeLessThan(p.indexOf('LANGUAGE RULE'))
    expect(p).toMatch(/Always answer in Persian/)
  })

  it('keeps user context last so it never sits above the rule', () => {
    const p = buildSystemPrompt(MODULE_PROMPT, 'fa', 'visitor from /solutions')
    expect(p).toContain('User context: visitor from /solutions')
    expect(p.indexOf('LANGUAGE RULE')).toBeLessThan(p.indexOf('User context'))
  })

  it('the en locale gets the English rule on a Persian base prompt', () => {
    const p = buildSystemPrompt(DEFAULT_PROMPT, 'en')
    expect(p).toMatch(/Always answer in English/)
  })
})
