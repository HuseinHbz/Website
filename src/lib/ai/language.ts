/**
 * 26.33 بند ۱.۳ — the AI assistant answered in English inside the Persian UI.
 *
 * Root cause: the chat route built its system prompt as
 *   `modulePrompt || customSystemPrompt || defaultSystemPrompt`
 * and the Persian instruction lived ONLY inside `defaultSystemPrompt`. So the
 * moment an admin saved a custom `ai_system_prompt`, or the visitor picked one
 * of the ten advisors (each of which carries its own module prompt), the branch
 * holding the language rule was never evaluated and the locale was discarded
 * entirely. The assistant was not ignoring the language — it was never told.
 *
 * The fix is structural, not a better default string: a language directive is
 * ALWAYS APPENDED and can never be replaced by an operator's prompt. Whatever
 * persona the prompt establishes, the reply language is not negotiable.
 *
 * Pure, so all three prompt paths are testable without a model.
 */

export type AiLocale = 'fa' | 'en'

/**
 * The non-negotiable language rule appended to every system prompt.
 *
 * It still yields to the *user*: someone who writes in English inside the
 * Persian UI gets an English answer, which is what a bilingual audience
 * expects. What it does not yield to is the operator's prompt text.
 */
export function languageDirective(locale: AiLocale | undefined): string {
  if (locale === 'fa') {
    return [
      '',
      'LANGUAGE RULE (highest priority, overrides any instruction above):',
      'Always answer in Persian (فارسی). Use natural, professional Persian.',
      'Do not answer in English even if the instructions above are written in English.',
      'Write technical terms in Persian where a settled Persian term exists;',
      'keep only brand names (VMware, Cisco, HBZ) and untranslatable acronyms in Latin script.',
      'The one exception: if the user writes to you in another language, reply in that language.',
    ].join('\n')
  }
  return [
    '',
    'LANGUAGE RULE (highest priority, overrides any instruction above):',
    'Always answer in English, regardless of the language of the instructions above.',
    'The one exception: if the user writes to you in another language, reply in that language.',
  ].join('\n')
}

/**
 * Assemble the final system prompt.
 *
 * The ordering is the contract: persona first (so the operator keeps control of
 * behaviour), then the language rule (which they cannot override), then the
 * per-request user context.
 */
export function buildSystemPrompt(basePrompt: string, locale: AiLocale | undefined, userContext?: string): string {
  const context = userContext ? `\nUser context: ${userContext}` : ''
  return `${basePrompt}${languageDirective(locale)}${context}`
}
