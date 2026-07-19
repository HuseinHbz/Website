import { getDb } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { breakers } from '@/lib/circuitBreaker'

async function getSetting(key: string): Promise<string> {
  try {
    const db = getDb()
    const row = (await db.select().from(siteSettings).where(eq(siteSettings.key, key)))[0]
    return row?.value ?? ''
  } catch { return '' }
}

export interface NotificationData {
  type: 'consultation' | 'contact' | 'report'
  subject: string
  body: string
}

export interface MailInput {
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: { filename: string; content: string; contentType?: string }[]
}

/**
 * Low-level SMTP send using the CMS-configured server (site_settings smtp_*).
 * Used by explicit admin actions (e.g. emailing a generated document), so it is
 * NOT gated by the notify_* toggles — only by SMTP being configured. Returns a
 * result instead of throwing so callers can surface "not configured" cleanly.
 */
export async function sendMail(mail: MailInput): Promise<{ ok: boolean; error?: string }> {
  const smtpHost = await getSetting('smtp_host')
  const smtpPort = await getSetting('smtp_port')
  const smtpUser = await getSetting('smtp_user')
  const smtpPass = await getSetting('smtp_pass')
  const smtpFrom = await getSetting('smtp_from')
  if (!smtpHost) return { ok: false, error: 'SMTP is not configured (Settings → smtp_host)' }
  try {
    const nm = (await import('nodemailer')) as unknown as { createTransport: (cfg: unknown) => { sendMail: (opts: unknown) => Promise<void> } }
    const transporter = nm.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '587'),
      secure: smtpPort === '465',
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    })
    await breakers.smtp.execute(() => transporter.sendMail({
      from: smtpFrom || smtpUser,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    }))
    return { ok: true }
  } catch (err) {
    console.error('SMTP send failed:', err)
    return { ok: false, error: 'SMTP send failed' }
  }
}

export async function sendEmailNotification(data: NotificationData) {
  const notifyTo = await getSetting('notify_email_to')
  const notifyEnabled = await getSetting(`notify_email_${data.type}s`)
  if (!notifyTo || notifyEnabled !== '1') return
  await sendMail({ to: notifyTo, subject: data.subject, text: data.body })
}

export async function sendSmsNotification(data: NotificationData) {
  const apiKey = await getSetting('sms_ir_api_key')
  const lineNumber = await getSetting('sms_ir_line')
  const toNumber = await getSetting('sms_notify_to')
  const notifyEnabled = await getSetting(`notify_sms_${data.type}s`)

  if (!apiKey || !toNumber || notifyEnabled !== '1') return

  try {
    const messageText = `${data.subject}\n${data.body}`.slice(0, 160)
    const res = await fetch('https://api.sms.ir/v1/send/plain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        lineNumber,
        MessageText: messageText,
        Mobiles: [toNumber],
      }),
    })
    if (!res.ok) {
      console.error('SMS notification failed:', res.status)
    }
  } catch (err) {
    console.error('SMS notification failed:', err)
  }
}

export async function notify(data: NotificationData) {
  await Promise.allSettled([
    sendEmailNotification(data),
    sendSmsNotification(data),
  ])
}
