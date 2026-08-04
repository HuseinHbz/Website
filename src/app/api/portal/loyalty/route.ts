/**
 * Phase 27 بند۲ — the customer's own loyalty view.
 *
 * A loyalty club the member cannot see is not a club. This is the read side of
 * it, scoped to the SERVER session's customer — never to a customer id sent by
 * the client, which is what keeps one member from reading another's balance
 * (the 26.25a portal isolation rule).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePortal } from '@/lib/portal/guard'
import { customerLoyalty } from '@/lib/crm/loyaltyData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requirePortal(req)
  if ('error' in auth) return auth.error
  // customerId comes from the session, never from the request.
  const data = await customerLoyalty(auth.identity.customerId)
  return NextResponse.json({
    program: data.program ? { nameEn: data.program.nameEn, nameFa: data.program.nameFa, redeemRate: data.program.redeemRate } : null,
    balance: data.account?.balance ?? 0,
    value: data.account?.value ?? 0,
    totalEarned: data.account?.totalEarned ?? 0,
    totalSpent: data.account?.totalSpent ?? 0,
    tier: data.tier,
    tiers: data.tiers,
    // The member sees their own movements — that is what makes the balance
    // believable rather than a number they are asked to trust.
    ledger: data.ledger.slice(0, 50),
  })
}
