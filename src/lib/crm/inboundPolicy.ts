/**
 * Inbound-lead flood policy (Phase 26.25b بند ۰.۶). Public webhooks let anyone
 * inject inbound messages; a rotating sender would otherwise mint an unbounded
 * stream of fake leads — saturating SLA alerts and poisoning CAC/attribution.
 * Pure, unit-testable decisions; the DB counts feed these functions.
 */
export interface InboundCaps {
  /** Max inbound messages accepted across ALL channels per window. */
  globalPerWindow: number
  /** Max inbound messages accepted per single channel per window. */
  perChannelPerWindow: number
  /** Rolling window length in minutes. */
  windowMinutes: number
}

export const DEFAULT_INBOUND_CAPS: InboundCaps = {
  globalPerWindow: 200,
  perChannelPerWindow: 100,
  windowMinutes: 60,
}

/** Coerce raw erp_settings strings into a valid caps object (safe fallbacks). */
export function parseCaps(raw: Partial<Record<'global' | 'channel' | 'window', string | number | null>>): InboundCaps {
  const n = (v: unknown, d: number) => {
    const x = Number(v)
    return Number.isFinite(x) && x > 0 ? Math.floor(x) : d
  }
  return {
    globalPerWindow: n(raw.global, DEFAULT_INBOUND_CAPS.globalPerWindow),
    perChannelPerWindow: n(raw.channel, DEFAULT_INBOUND_CAPS.perChannelPerWindow),
    windowMinutes: n(raw.window, DEFAULT_INBOUND_CAPS.windowMinutes),
  }
}

export interface RateVerdict { exceeded: boolean; reason?: 'global' | 'channel' }

/**
 * Given the message counts already recorded in the current window, decide whether
 * a NEW inbound message pushes past a cap. `globalCount`/`channelCount` are the
 * counts BEFORE this message; accepting it would make them +1, so `>=` is the
 * correct boundary (the cap is the max number accepted).
 */
export function inboundRateExceeded(globalCount: number, channelCount: number, caps: InboundCaps): RateVerdict {
  if (globalCount >= caps.globalPerWindow) return { exceeded: true, reason: 'global' }
  if (channelCount >= caps.perChannelPerWindow) return { exceeded: true, reason: 'channel' }
  return { exceeded: false }
}
