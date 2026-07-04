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

export async function sendEmailNotification(data: NotificationData) {
  const smtpHost = await getSetting('smtp_host')
  const smtpPort = await getSetting('smtp_port')
  const smtpUser = await getSetting('smtp_user')
  const smtpPass = await getSetting('smtp_pass')
  const smtpFrom = await getSetting('smtp_from')
  const notifyTo = await getSetting('notify_email_to')
  const notifyEnabled = await getSetting(`notify_email_${data.type}s`)

  if (!smtpHost || !notifyTo || notifyEnabled !== '1') return

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
      to: notifyTo,
      subject: data.subject,
      text: data.body,
    }))
  } catch (err) {
    console.error('Email notification failed:', err)
  }
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
