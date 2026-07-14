/**
 * Payment gateway abstraction (Phase 26.24 بند ۴.۲). One interface, N Iranian
 * providers. Zarrinpal is fully implemented (it has an official sandbox);
 * Saman & Mellat are real skeletons that follow the same contract and are
 * wired but return a not-configured error until their merchant credentials
 * are set. Pure request/response mapping — the data layer does the DB + GL.
 */

export type ProviderId = 'zarinpal' | 'saman' | 'mellat'

export interface PaymentRequest {
  amount: number       // Rial
  description: string
  callbackUrl: string
  mobile?: string
  email?: string
  orderId?: string
}
export interface PaymentInitResult { ok: boolean; authority?: string; redirectUrl?: string; error?: string }
export interface PaymentVerifyResult { ok: boolean; refId?: string; error?: string; alreadyVerified?: boolean }

export interface GatewayProvider {
  id: ProviderId
  /** Start a payment → provider authority + redirect URL. */
  init(req: PaymentRequest, cfg: GatewayConfig): Promise<PaymentInitResult>
  /** Verify a callback → confirmed reference id. */
  verify(authority: string, amount: number, cfg: GatewayConfig): Promise<PaymentVerifyResult>
}

export interface GatewayConfig { merchantId?: string; sandbox?: boolean }

// ── Zarrinpal (official sandbox) ─────────────────────────────────────────────
const zarinpal: GatewayProvider = {
  id: 'zarinpal',
  async init(req, cfg) {
    if (!cfg.merchantId) return { ok: false, error: 'Zarrinpal merchant id is not configured' }
    const base = cfg.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'
    try {
      const res = await fetch(`${base}/pg/v4/payment/request.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ merchant_id: cfg.merchantId, amount: Math.round(req.amount), description: req.description, callback_url: req.callbackUrl, metadata: { mobile: req.mobile, email: req.email } }),
      })
      const d = await res.json()
      const authority = d?.data?.authority
      if (!authority) return { ok: false, error: d?.errors?.message ?? 'Zarrinpal init failed' }
      return { ok: true, authority, redirectUrl: `${base}/pg/StartPay/${authority}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Zarrinpal init error' } }
  },
  async verify(authority, amount, cfg) {
    if (!cfg.merchantId) return { ok: false, error: 'Zarrinpal merchant id is not configured' }
    const base = cfg.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'
    try {
      const res = await fetch(`${base}/pg/v4/payment/verify.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ merchant_id: cfg.merchantId, amount: Math.round(amount), authority }),
      })
      const d = await res.json()
      const code = d?.data?.code
      if (code === 100) return { ok: true, refId: String(d.data.ref_id) }
      if (code === 101) return { ok: true, refId: String(d.data.ref_id), alreadyVerified: true }
      return { ok: false, error: d?.errors?.message ?? `Zarrinpal verify code ${code ?? '?'}` }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Zarrinpal verify error' } }
  },
}

// ── Saman / Mellat skeletons (same contract, credential-gated) ───────────────
function skeleton(id: ProviderId): GatewayProvider {
  return {
    id,
    async init(_req, cfg) {
      if (!cfg.merchantId) return { ok: false, error: `${id} terminal is not configured — set merchant credentials` }
      // Real endpoint call goes here once the merchant terminal is provisioned.
      return { ok: false, error: `${id} adapter is wired but awaiting merchant credential (blocked-external)` }
    },
    async verify(_a, _amt, cfg) {
      if (!cfg.merchantId) return { ok: false, error: `${id} terminal is not configured` }
      return { ok: false, error: `${id} verify awaiting merchant credential (blocked-external)` }
    },
  }
}

export const PROVIDERS: Record<ProviderId, GatewayProvider> = {
  zarinpal,
  saman: skeleton('saman'),
  mellat: skeleton('mellat'),
}

export function getProvider(id: string): GatewayProvider {
  return PROVIDERS[(id as ProviderId)] ?? PROVIDERS.zarinpal
}
