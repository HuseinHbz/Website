import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireAdmin, readJson, badRequest } from '@/lib/api/respond'
import { logAction } from '@/lib/admin/audit'
import { loadDocumentRow, renderDocument } from '@/lib/erp/documentData'
import { sendMail } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  id: z.number().int().positive(),
  to: z.string().email().max(160),
  subject: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
})

/** Email a generated document (print-ready HTML attached) via the CMS SMTP. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin('edit')
  if ('error' in auth) return auth.error
  const parsed = await readJson(req, schema)
  if ('error' in parsed) return parsed.error
  const d = parsed.data
  try {
    const row = await loadDocumentRow(d.id)
    if (!row) return badRequest('Document not found')
    if (row.status === 'void') return badRequest('Voided documents cannot be emailed')
    const html = await renderDocument(d.id)
    if (!html) return badRequest('Document could not be rendered')

    const subject = d.subject?.trim() || `${row.title} ${row.number}`
    const bodyText = d.message?.trim()
      || `Please find attached ${row.title} ${row.number} (dated ${row.date}).\nOpen the attachment in a browser and use Print / Save as PDF.\nVerify code: ${row.verifyCode}`
    const sent = await sendMail({
      to: d.to,
      subject,
      text: bodyText,
      attachments: [{ filename: `${row.number.replace(/[^A-Za-z0-9._-]/g, '_')}.html`, content: html, contentType: 'text/html' }],
    })
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 })
    await logAction(auth.user, 'doc.email', 'gen_document', d.id, null, { to: d.to, number: row.number })
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e, 'Failed to email document') }
}
