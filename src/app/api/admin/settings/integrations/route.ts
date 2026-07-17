import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import {
  INTEGRATION_PROVIDERS, INTEGRATION_KEYS, SECRET_KEYS,
  readIntegrationStatus, saveIntegrationKey, testProvider,
} from '@/lib/erp/integrationSettings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Integration credential settings (BUG-015). GET returns the registry + a masked
 * status (secrets never leave the server); POST saves a key (write-only) or runs
 * a connection test. `manage_settings` gated; the audit record NEVER carries the
 * value of a secret.
 */
export async function GET() {
  const auth = await requireAdmin('manage_settings')
  if ('error' in auth) return auth.error
  try {
    const status = await readIntegrationStatus()
    return NextResponse.json({ providers: INTEGRATION_PROVIDERS, status })
  } catch (e) { return apiError(e, 'Failed to load integration settings') }
}

const saveSchema = z.object({
  action: z.literal('save'),
  key: z.string().refine(k => INTEGRATION_KEYS.includes(k), 'unknown key'),
  value: z.string().max(8192),
})
const testSchema = z.object({
  action: z.literal('test'),
  provider: z.string().refine(id => INTEGRATION_PROVIDERS.some(p => p.id === id), 'unknown provider'),
})
const schema = z.discriminatedUnion('action', [saveSchema, testSchema])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin('manage_settings')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    if (d.action === 'save') {
      await saveIntegrationKey(d.key, d.value)
      // Audit WITHOUT the value: log only which key changed and whether it was set/cleared.
      const secret = SECRET_KEYS.has(d.key)
      await logAction(auth.user, 'integration.settings.update', 'erp_settings', d.key, {
        key: d.key, secret, set: d.value !== '', value: secret ? undefined : d.value,
      })
      return NextResponse.json({ ok: true, status: await readIntegrationStatus() })
    }
    const result = await testProvider(d.provider)
    await logAction(auth.user, 'integration.settings.test', 'erp_settings', d.provider, { provider: d.provider, mode: result.mode })
    return NextResponse.json({ ok: result.ok, result })
  } catch (e) { return apiError(e, 'Failed to update integration settings') }
}
