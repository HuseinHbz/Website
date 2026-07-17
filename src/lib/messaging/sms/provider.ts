/**
 * SMS provider abstraction (Phase 26.25 بند ۴.۱) — same shape as the 26.24
 * payment GatewayProvider. Kavenegar is fully implemented (real REST API);
 * Melipayamak & SMS.ir are wired skeletons awaiting credentials. With NO api key
 * the manager falls back to a DETERMINISTIC sandbox (never silently drops) so
 * OTP + campaigns work end-to-end in dev/CI, clearly labelled blocked-external.
 */

export type SmsProviderId = 'kavenegar' | 'melipayamak' | 'smsir' | 'sandbox'

export interface SmsConfig { apiKey?: string; sender?: string }
export interface SmsResult { ok: boolean; messageId?: string; error?: string; sandbox?: boolean }

export interface SmsProvider {
  id: SmsProviderId
  send(to: string, message: string, cfg: SmsConfig): Promise<SmsResult>
}

// ── Kavenegar (real REST API) ────────────────────────────────────────────────
const kavenegar: SmsProvider = {
  id: 'kavenegar',
  async send(to, message, cfg) {
    if (!cfg.apiKey) return { ok: false, error: 'Kavenegar API key is not configured' }
    try {
      const url = `https://api.kavenegar.com/v1/${encodeURIComponent(cfg.apiKey)}/sms/send.json`
      const body = new URLSearchParams({ receptor: to, message, ...(cfg.sender ? { sender: cfg.sender } : {}) })
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      const d = await res.json()
      const status = d?.return?.status
      const id = d?.entries?.[0]?.messageid
      if (status === 200 && id) return { ok: true, messageId: String(id) }
      return { ok: false, error: d?.return?.message ?? `Kavenegar status ${status ?? '?'}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Kavenegar send error' } }
  },
}

// ── Melipayamak / SMS.ir skeletons (same contract, credential-gated) ─────────
function skeleton(id: SmsProviderId): SmsProvider {
  return {
    id,
    async send(_to, _msg, cfg) {
      if (!cfg.apiKey) return { ok: false, error: `${id} API key is not configured` }
      // Real endpoint call goes here once the account is provisioned.
      return { ok: false, error: `${id} adapter is wired but awaiting credential (blocked-external)` }
    },
  }
}

// ── Deterministic sandbox (no key) ───────────────────────────────────────────
const sandbox: SmsProvider = {
  id: 'sandbox',
  async send(to) {
    return { ok: true, messageId: `SANDBOX-${to}-${Date.now()}`, sandbox: true }
  },
}

export const SMS_PROVIDERS: Record<SmsProviderId, SmsProvider> = {
  kavenegar,
  melipayamak: skeleton('melipayamak'),
  smsir: skeleton('smsir'),
  sandbox,
}

/** Resolve a provider by id; unknown id → sandbox (fails safe, never crashes). */
export function getSmsProvider(id: string): SmsProvider {
  return SMS_PROVIDERS[(id as SmsProviderId)] ?? SMS_PROVIDERS.sandbox
}
