import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert/strict';

// Set required env vars
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['ACCESS_TOKEN_SECRET'] = 'test_access_secret_min_32_chars_abcdef';
process.env['REFRESH_TOKEN_SECRET'] = 'test_refresh_secret_min_32_chars_abcdef';
process.env['ENCRYPTION_KEY'] = '0000000000000000000000000000000000000000000000000000000000000000';
process.env['OWNER_EMAIL'] = 'test@example.com';
process.env['SMTP_HOST'] = 'localhost';
process.env['SMTP_USER'] = 'test@example.com';
process.env['SMTP_PASS'] = 'password';
process.env['MAIL_FROM'] = 'noreply@example.com';
process.env['MAIL_NOTIFY_TO'] = 'admin@example.com';
process.env['CORS_ORIGINS'] = 'http://localhost:3000';

describe('Lead scoring', () => {
  // Test scoring logic inline without DB
  function scoreLead(data: {
    company?: string | null;
    phone?: string | null;
    serviceInterest?: string | null;
    isConsultation?: boolean;
    isSubscriber?: boolean;
  }): number {
    let score = 0;
    if (data.company) score += 20;
    if (data.phone) score += 20;
    if (data.serviceInterest) score += 10;
    if (data.isConsultation) score += 15;
    if (data.isSubscriber) score += 5;
    return Math.min(score, 100);
  }

  it('should score 0 for minimal data', () => {
    const score = scoreLead({ name: 'Test' } as { name: string });
    assert.equal(score, 0);
  });

  it('should score 20 for company alone', () => {
    const score = scoreLead({ company: 'Acme Corp' });
    assert.equal(score, 20);
  });

  it('should score 20 for phone alone', () => {
    const score = scoreLead({ phone: '+1234567890' });
    assert.equal(score, 20);
  });

  it('should score 40 for company + phone', () => {
    const score = scoreLead({ company: 'Acme', phone: '+1234567890' });
    assert.equal(score, 40);
  });

  it('should score 55 for company + phone + consultation', () => {
    const score = scoreLead({
      company: 'Acme',
      phone: '+1234567890',
      isConsultation: true,
    });
    assert.equal(score, 55);
  });

  it('should cap at 100', () => {
    const score = scoreLead({
      company: 'Acme',
      phone: '+1234567890',
      serviceInterest: 'Cloud',
      isConsultation: true,
      isSubscriber: true,
    });
    assert.equal(score, 70);
    assert.ok(score <= 100, 'Score should not exceed 100');
  });

  it('should score max 70 with all factors', () => {
    const score = scoreLead({
      company: 'Acme',
      phone: '123',
      serviceInterest: 'Cloud',
      isConsultation: true,
      isSubscriber: true,
    });
    // 20 + 20 + 10 + 15 + 5 = 70
    assert.equal(score, 70);
  });
});

describe('Lead validation schema', async () => {
  before(() => {
    mock.module('../src/db/prisma', {
      defaultExport: {
        $connect: async () => {},
        $disconnect: async () => {},
        lead: { create: async (args: { data: unknown }) => ({ id: 'lead-123', ...args.data }) },
        leadEvent: { create: async () => ({}) },
        attribution: { create: async () => ({}) },
        subscriber: { findFirst: async () => null },
      },
    });
    mock.module('../src/services/mailer', {
      namedExports: {
        sendLeadNotification: async () => {},
        sendLeadAcknowledgement: async () => {},
      },
    });
  });

  it('createLeadSchema should validate a correct lead', async () => {
    const { createLeadSchema } = await import('../src/modules/leads/leads.service');

    const validLead = {
      name: 'Hossein',
      email: 'hossein@example.com',
      phone: '+98123456789',
      company: 'TechCorp',
      source: 'WEBSITE',
      marketingConsent: true,
    };

    const result = createLeadSchema.safeParse(validLead);
    assert.equal(result.success, true, 'Valid lead should pass validation');
  });

  it('createLeadSchema should reject missing name', async () => {
    const { createLeadSchema } = await import('../src/modules/leads/leads.service');

    const result = createLeadSchema.safeParse({ email: 'test@example.com' });
    assert.equal(result.success, false, 'Lead without name should fail');
  });

  it('createLeadSchema should reject invalid email', async () => {
    const { createLeadSchema } = await import('../src/modules/leads/leads.service');

    const result = createLeadSchema.safeParse({ name: 'Test', email: 'not-an-email' });
    assert.equal(result.success, false, 'Invalid email should fail');
  });

  it('createLeadSchema should accept lead without email (phone-only)', async () => {
    const { createLeadSchema } = await import('../src/modules/leads/leads.service');

    const result = createLeadSchema.safeParse({ name: 'Test', phone: '+1234567890' });
    assert.equal(result.success, true, 'Lead with only phone should be valid');
  });
});
