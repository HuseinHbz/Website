import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../lib/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSmtpConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM && env.MAIL_NOTIFY_TO);
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export interface LeadData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  score: number;
  notes?: string | null;
  marketingConsent: boolean;
  createdAt: Date;
}

export async function sendLeadNotification(lead: LeadData): Promise<void> {
  if (!isSmtpConfigured()) {
    logger.warn({ leadId: lead.id }, 'SMTP not configured — skipping lead notification email');
    return;
  }
  const transport = createTransport();

  const html = `
    <h2>New Lead: ${escapeHtml(lead.name)}</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Name</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(lead.name)}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(lead.email ?? 'N/A')}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(lead.phone ?? 'N/A')}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Company</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(lead.company ?? 'N/A')}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Source</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(lead.source)}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Score</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${lead.score}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Marketing Consent</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${lead.marketingConsent ? 'Yes' : 'No'}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Created</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${lead.createdAt.toISOString()}</td></tr>
    </table>
    ${lead.notes ? `<p><strong>Notes:</strong> ${escapeHtml(lead.notes)}</p>` : ''}
    <p><a href="${escapeHtml(`${process.env['ADMIN_URL'] ?? 'https://admin.habibazar.ir'}/leads/${lead.id}`)}">View in Admin</a></p>
  `;

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: env.MAIL_NOTIFY_TO,
      subject: `New Lead: ${lead.name}${lead.company ? ` (${lead.company})` : ''} — Score: ${lead.score}`,
      html,
    });
    logger.info({ leadId: lead.id }, 'Lead notification email sent');
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Failed to send lead notification email');
  }
}

export async function sendLeadAcknowledgement(lead: LeadData): Promise<void> {
  if (!lead.email || !lead.marketingConsent) return;
  if (!isSmtpConfigured()) {
    logger.warn({ leadId: lead.id }, 'SMTP not configured — skipping lead acknowledgement email');
    return;
  }

  const transport = createTransport();

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>با تشکر از تماس شما</h2>
      <p>سلام ${escapeHtml(lead.name)} عزیز،</p>
      <p>پیام شما دریافت شد. تیم ما در اسرع وقت با شما تماس خواهد گرفت.</p>
      <p>با احترام،<br>حسین حبی باذر<br>مشاور زیرساخت سازمانی</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        اگر می‌خواهید از لیست ما خارج شوید، لطفاً به این ایمیل پاسخ دهید.
      </p>
    </div>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto;">
      <h2>Thank you for reaching out</h2>
      <p>Dear ${escapeHtml(lead.name)},</p>
      <p>Your message has been received. Our team will get back to you shortly.</p>
      <p>Best regards,<br>Hossein Habibazar<br>Enterprise Infrastructure Consultant</p>
    </div>
  `;

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: lead.email,
      subject: 'پیام شما دریافت شد / Your message has been received — Habibazar',
      html,
    });
    logger.info({ leadId: lead.id }, 'Lead acknowledgement email sent');
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'Failed to send lead acknowledgement email');
  }
}

export async function sendConsultationConfirmation(data: {
  name: string;
  email: string;
  kind: string;
  preferredDate?: Date | null;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    logger.warn('SMTP not configured — skipping consultation confirmation email');
    return;
  }
  const transport = createTransport();

  const html = `
    <h2>Consultation Request Received</h2>
    <p>Dear ${escapeHtml(data.name)},</p>
    <p>Your consultation request (${escapeHtml(data.kind)}) has been received.</p>
    ${data.preferredDate ? `<p>Preferred date: ${data.preferredDate.toLocaleDateString()}</p>` : ''}
    <p>We will confirm the appointment shortly.</p>
    <p>Best regards,<br>Habibazar Team</p>
  `;

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: data.email,
      subject: 'Consultation Request Confirmed — Habibazar',
      html,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to send consultation confirmation');
  }
}
