/**
 * Phase 28.5 بند ۱ — pure recruitment-pipeline helpers. No I/O, so the stage
 * machine and its labels are testable without a database.
 */
export const APPLICATION_STAGES = [
  'screening', 'interview_1', 'interview_2', 'offer', 'rejected', 'hired',
] as const
export type ApplicationStage = typeof APPLICATION_STAGES[number]

export const STAGE_LABELS: Record<ApplicationStage, { en: string; fa: string }> = {
  screening:   { en: 'Résumé screening', fa: 'بررسی رزومه' },
  interview_1: { en: 'First interview',  fa: 'مصاحبهٔ اول' },
  interview_2: { en: 'Second interview', fa: 'مصاحبهٔ دوم' },
  offer:       { en: 'Offer',            fa: 'پیشنهاد' },
  rejected:    { en: 'Rejected',         fa: 'رد شده' },
  hired:       { en: 'Hired',            fa: 'استخدام‌شده' },
}

/** A closed stage (rejected/hired) is terminal — the kanban may not move it further. */
export function isTerminalStage(stage: ApplicationStage): boolean {
  return stage === 'rejected' || stage === 'hired'
}

/** Whether an application may move into `next` from `current` — kanban guard. */
export function canTransition(current: ApplicationStage, next: ApplicationStage): boolean {
  if (isTerminalStage(current)) return false
  if (next === 'rejected') return true // any live stage can be rejected
  const order: ApplicationStage[] = ['screening', 'interview_1', 'interview_2', 'offer', 'hired']
  const ci = order.indexOf(current)
  const ni = order.indexOf(next)
  return ci >= 0 && ni === ci + 1
}
