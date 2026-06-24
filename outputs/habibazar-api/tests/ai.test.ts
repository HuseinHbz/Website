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
process.env['AI_PROVIDER'] = 'openai';

describe('AI Schemas', async () => {
  it('intakeSchema should validate correct intake', async () => {
    const { intakeSchema } = await import('../src/modules/ai/ai.schemas');

    const valid = {
      name: 'Ali',
      company: 'TechCorp',
      phone: '+98123456789',
      locale: 'FA',
      sessionRef: 'session-abc-123',
    };

    const result = intakeSchema.safeParse(valid);
    assert.equal(result.success, true, 'Valid intake should pass');
  });

  it('intakeSchema should require sessionRef', async () => {
    const { intakeSchema } = await import('../src/modules/ai/ai.schemas');

    const result = intakeSchema.safeParse({ name: 'Ali', locale: 'FA' });
    assert.equal(result.success, false, 'Missing sessionRef should fail');
  });

  it('chatMessageSchema should validate message', async () => {
    const { chatMessageSchema } = await import('../src/modules/ai/ai.schemas');

    const result = chatMessageSchema.safeParse({ message: 'Hello', locale: 'EN' });
    assert.equal(result.success, true);

    const emptyMsg = chatMessageSchema.safeParse({ message: '', locale: 'FA' });
    assert.equal(emptyMsg.success, false, 'Empty message should fail');
  });

  it('chatMessageSchema should reject overly long message', async () => {
    const { chatMessageSchema } = await import('../src/modules/ai/ai.schemas');

    const longMsg = 'x'.repeat(4001);
    const result = chatMessageSchema.safeParse({ message: longMsg, locale: 'FA' });
    assert.equal(result.success, false, 'Message exceeding 4000 chars should fail');
  });
});

describe('AI Prompts', async () => {
  it('should return FA prompt for FA locale', async () => {
    const { getSystemPrompt } = await import('../src/modules/ai/ai.prompts');
    const prompt = getSystemPrompt('FA');
    assert.ok(prompt.length > 100, 'FA prompt should be substantial');
    assert.ok(prompt.includes('حسین'), 'FA prompt should mention Hossein in Persian');
  });

  it('should return EN prompt for EN locale', async () => {
    const { getSystemPrompt } = await import('../src/modules/ai/ai.prompts');
    const prompt = getSystemPrompt('EN');
    assert.ok(prompt.length > 100, 'EN prompt should be substantial');
    assert.ok(prompt.includes('Hossein'), 'EN prompt should mention Hossein');
    assert.ok(prompt.includes('NEVER'), 'EN prompt should include integrity constraints');
  });

  it('FA and EN prompts should be different', async () => {
    const { getSystemPrompt } = await import('../src/modules/ai/ai.prompts');
    const fa = getSystemPrompt('FA');
    const en = getSystemPrompt('EN');
    assert.notEqual(fa, en, 'FA and EN prompts should be different');
  });
});

describe('AI service - startConversation', async () => {
  const mockConversation = {
    id: 'conv-123',
    sessionRefHash: 'abc123',
    name: 'Ali',
    company: 'TechCorp',
    phone: null,
    category: null,
    locale: 'FA',
    turnCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  before(() => {
    mock.module('../src/db/prisma', {
      defaultExport: {
        $connect: async () => {},
        conversation: {
          findFirst: async () => null,
          create: async () => mockConversation,
          update: async () => mockConversation,
        },
        lead: {
          findFirst: async () => null,
          create: async () => ({ id: 'lead-123' }),
        },
        message: {
          create: async () => ({}),
          findMany: async () => [],
        },
      },
    });
  });

  it('should create a new conversation', async () => {
    const aiService = await import('../src/modules/ai/ai.service');
    const result = await aiService.startConversation({
      name: 'Ali',
      company: 'TechCorp',
      locale: 'FA',
      sessionRef: 'unique-session-ref-xyz',
    });

    assert.ok(result.id, 'Conversation should have an id');
    assert.equal(result.locale, 'FA');
  });

  it('should return existing conversation for same session ref', async () => {
    mock.module('../src/db/prisma', {
      defaultExport: {
        $connect: async () => {},
        conversation: {
          findFirst: async () => mockConversation, // Returns existing
          create: async () => { throw new Error('Should not create') },
        },
        lead: { findFirst: async () => null },
      },
    });

    // Fresh import to pick up new mock
    const aiService = await import('../src/modules/ai/ai.service');
    const result = await aiService.startConversation({
      sessionRef: 'existing-session',
      locale: 'FA',
    });

    assert.equal(result.id, mockConversation.id);
  });
});
