/**
 * Prompt Center (Phase 22 — AI Platform, subsystem 6).
 *
 * Pure helpers for versioned prompt templates: variable extraction and
 * `{{var}}` interpolation. Side-effect free → unit-tested. Versioning, approval
 * and rollback live in the API (they mutate the DB); the head/version model is
 * `ai_prompts` (current + active version + status) × `ai_prompt_versions`.
 */

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Distinct variable names referenced by a template, in first-seen order. */
export function extractVariables(body: string): string[] {
  const seen: string[] = []
  let m: RegExpExecArray | null
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(body))) {
    if (!seen.includes(m[1])) seen.push(m[1])
  }
  return seen
}

/** Interpolate `{{var}}` placeholders. Unknown/missing vars are left intact. */
export function renderPrompt(body: string, vars: Record<string, string> = {}): string {
  return body.replace(VAR_RE, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole,
  )
}

/** Which referenced variables have no value supplied. */
export function missingVariables(body: string, vars: Record<string, string> = {}): string[] {
  return extractVariables(body).filter(v => !Object.prototype.hasOwnProperty.call(vars, v) || vars[v] === '')
}

export type PromptStatus = 'draft' | 'approved' | 'archived'

/** A prompt is safe to use by other subsystems only once approved & non-empty. */
export function isUsable(status: PromptStatus, activeBody: string): boolean {
  return status === 'approved' && activeBody.trim().length > 0
}
