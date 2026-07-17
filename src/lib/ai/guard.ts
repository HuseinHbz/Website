/**
 * AI input guard — defensive security for the public chat endpoint.
 *
 * The chat route embeds user text into a system prompt alongside retrieved
 * knowledge-base context. Without guarding, a user can attempt prompt injection
 * ("ignore previous instructions…"), jailbreaks ("DAN / developer mode"), system-
 * prompt/secret exfiltration, or break the RAG framing by injecting the context
 * delimiters. This module detects those attempts, sanitizes the delimiters, and
 * enforces size caps — it does NOT call any model.
 *
 * Design goals: block the clear attacks, avoid false positives on legitimate IT /
 * infrastructure questions (this is a tech-consulting assistant), and stay fully
 * deterministic + unit-testable.
 */

export type Risk = 'none' | 'low' | 'high'
export interface GuardVerdict {
  verdict: 'allow' | 'block'
  risk: Risk
  reasons: string[]
}

export const MAX_MESSAGE_LEN = 8000
export const MAX_MESSAGES = 40

// High-risk: direct instruction-override / jailbreak / exfiltration attempts.
const HIGH_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bignore\s+(all\s+)?(the\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|messages?|context)\b/i, reason: 'instruction-override' },
  { re: /\bdisregard\s+(all\s+)?(your|the|previous|above)\s+(instructions?|rules?|guidelines?|prompt)\b/i, reason: 'instruction-override' },
  { re: /\b(reveal|show|print|repeat|expose|leak|display)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)\b/i, reason: 'system-prompt-exfiltration' },
  { re: /\b(what\s+(is|are)|tell\s+me)\s+your\s+(system\s+)?(prompt|initial\s+instructions?)\b/i, reason: 'system-prompt-exfiltration' },
  { re: /\bdeveloper\s+mode\b/i, reason: 'jailbreak' },
  { re: /\b(do\s+anything\s+now|\bDAN\b\s+mode|jailbreak|jail\s?break)\b/i, reason: 'jailbreak' },
  { re: /\byou\s+are\s+now\s+(a\s+)?(?!hbz|an?\s+(it|infrastructure|network))/i, reason: 'role-override' },
  { re: /\b(pretend|act)\s+(to\s+be|as)\s+(if\s+you\s+are\s+)?(the\s+)?system\b/i, reason: 'role-override' },
  { re: /(?=.*\b(api[_\s-]?key|secret\s+key|access\s+token|credentials?|env(ironment)?\s+variables?)\b)(?=.*\b(reveal|show|print|give|leak|expose|dump|tell)\b)/i, reason: 'secret-exfiltration' },
  { re: /-{2,}\s*(end\s+)?context\s*-{2,}/i, reason: 'context-delimiter-injection' },
  { re: /\bsystem\s*:\s*you\s+(are|must)\b/i, reason: 'role-injection' },
]

// Low-risk: suspicious but often benign phrasing — allowed, flagged for logging.
const LOW_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bprompt\s+injection\b/i, reason: 'mentions-injection' },
  { re: /\bignore\s+(that|this)\b/i, reason: 'soft-ignore' },
  { re: /\bnew\s+instructions?\b/i, reason: 'mentions-new-instructions' },
]

/** Strip RAG framing delimiters a user might inject to escape the context block. */
export function sanitize(text: string): string {
  return text.replace(/-{2,}\s*(end\s+)?(knowledge\s+base\s+)?context\s*-{2,}/gi, '[filtered]')
}

function scan(text: string): { risk: Risk; reasons: string[] } {
  const reasons: string[] = []
  let risk: Risk = 'none'
  for (const p of HIGH_PATTERNS) if (p.re.test(text)) { reasons.push(p.reason); risk = 'high' }
  if (risk !== 'high') {
    for (const p of LOW_PATTERNS) if (p.re.test(text)) { reasons.push(p.reason); risk = 'low' }
  }
  return { risk, reasons: [...new Set(reasons)] }
}

/**
 * Inspect the chat messages. Only user-role content is scanned (assistant/system
 * echoes are the app's own text). Returns a verdict; `block` should short-circuit
 * with a safe refusal.
 */
export function guardMessages(messages: { role: string; content: string }[]): GuardVerdict {
  const reasons: string[] = []
  let risk: Risk = 'none'
  for (const m of messages) {
    if (m.role !== 'user' || typeof m.content !== 'string') continue
    const r = scan(m.content)
    if (r.risk === 'high') risk = 'high'
    else if (r.risk === 'low' && risk === 'none') risk = 'low'
    reasons.push(...r.reasons)
  }
  return { verdict: risk === 'high' ? 'block' : 'allow', risk, reasons: [...new Set(reasons)] }
}

export const REFUSAL =
  'درخواست شما شامل تلاش برای دور زدن دستورالعمل‌های سیستم است و پردازش نشد. لطفاً سؤال فنی خود را مطرح کنید. / ' +
  'Your request appeared to attempt overriding system instructions and was not processed. Please ask your technical question.'
