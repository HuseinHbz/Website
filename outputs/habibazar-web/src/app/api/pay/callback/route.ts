import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/erp/payments/paymentData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — public gateway callback (بند ۴.۲). The provider redirects the customer
// here with ?tx= (our transaction id) after payment. We verify server-side
// (never trust the client), reconcile → sales_payment + GL, then redirect the
// customer to a friendly result page. No credentials are exposed to the client.
export async function GET(req: NextRequest) {
  const txId = Number(req.nextUrl.searchParams.get('tx'))
  const status = req.nextUrl.searchParams.get('Status') ?? req.nextUrl.searchParams.get('status')
  const origin = req.nextUrl.origin
  if (!txId) return NextResponse.redirect(`${origin}/fa/pay/result?ok=0&reason=missing`)
  // Zarrinpal sends Status=NOK when the user cancels.
  if (status && /nok/i.test(status)) return NextResponse.redirect(`${origin}/fa/pay/result?ok=0&reason=canceled&tx=${txId}`)
  try {
    const res = await verifyPayment(txId)
    const q = res.ok ? `ok=1&ref=${encodeURIComponent(res.refId ?? '')}` : `ok=0&reason=${encodeURIComponent(res.error ?? 'failed')}`
    return NextResponse.redirect(`${origin}/fa/pay/result?${q}&tx=${txId}`)
  } catch {
    return NextResponse.redirect(`${origin}/fa/pay/result?ok=0&reason=error&tx=${txId}`)
  }
}
