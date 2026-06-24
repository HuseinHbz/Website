import { describe, it } from 'node:test';
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

describe('Slug utility', async () => {
  let slugify: (text: string) => string;

  it('should convert English text to slug', async () => {
    const { slugify: s } = await import('../src/lib/slug');
    slugify = s;

    assert.equal(slugify('Hello World'), 'hello-world');
    assert.equal(slugify('  Multiple   Spaces  '), 'multiple-spaces');
    assert.equal(slugify('Special!@#$%^Characters'), 'specialcharacters');
  });

  it('should handle Persian characters', async () => {
    const { slugify: s } = await import('../src/lib/slug');
    const result = s('زیرساخت ابری');
    assert.ok(typeof result === 'string', 'Should return a string');
    assert.ok(!result.includes(' '), 'Result should not contain spaces');
    // Persian chars get transliterated or removed
    assert.match(result, /^[a-z0-9-]*$/, 'Result should only contain ASCII');
  });

  it('should collapse multiple hyphens', async () => {
    const { slugify: s } = await import('../src/lib/slug');
    assert.equal(s('hello---world'), 'hello-world');
  });

  it('should strip leading and trailing hyphens', async () => {
    const { slugify: s } = await import('../src/lib/slug');
    const result = s('---hello---');
    assert.ok(!result.startsWith('-'), 'Should not start with hyphen');
    assert.ok(!result.endsWith('-'), 'Should not end with hyphen');
  });

  it('should lowercase everything', async () => {
    const { slugify: s } = await import('../src/lib/slug');
    assert.equal(s('UPPERCASE'), 'uppercase');
    assert.equal(s('MixedCase-Text'), 'mixedcase-text');
  });
});

describe('Pagination utilities', async () => {
  it('buildPaginationMeta should compute correct values', async () => {
    const { buildPaginationMeta } = await import('../src/lib/pagination');

    const meta = buildPaginationMeta(100, 2, 10);
    assert.equal(meta.total, 100);
    assert.equal(meta.page, 2);
    assert.equal(meta.limit, 10);
    assert.equal(meta.pages, 10);
    assert.equal(meta.hasNext, true);
    assert.equal(meta.hasPrev, true);
  });

  it('buildPaginationMeta first page', async () => {
    const { buildPaginationMeta } = await import('../src/lib/pagination');
    const meta = buildPaginationMeta(50, 1, 20);
    assert.equal(meta.hasPrev, false);
    assert.equal(meta.hasNext, true);
    assert.equal(meta.pages, 3);
  });

  it('buildPaginationMeta last page', async () => {
    const { buildPaginationMeta } = await import('../src/lib/pagination');
    const meta = buildPaginationMeta(50, 3, 20);
    assert.equal(meta.hasPrev, true);
    assert.equal(meta.hasNext, false);
  });

  it('buildPaginationMeta empty result', async () => {
    const { buildPaginationMeta } = await import('../src/lib/pagination');
    const meta = buildPaginationMeta(0, 1, 20);
    assert.equal(meta.pages, 0);
    assert.equal(meta.hasNext, false);
    assert.equal(meta.hasPrev, false);
  });

  it('buildPrismaSkipTake should compute skip/take', async () => {
    const { buildPrismaSkipTake } = await import('../src/lib/pagination');

    const page1 = buildPrismaSkipTake(1, 20);
    assert.equal(page1.skip, 0);
    assert.equal(page1.take, 20);

    const page2 = buildPrismaSkipTake(2, 20);
    assert.equal(page2.skip, 20);
    assert.equal(page2.take, 20);

    const page3 = buildPrismaSkipTake(3, 10);
    assert.equal(page3.skip, 20);
    assert.equal(page3.take, 10);
  });
});

describe('Validators', async () => {
  it('emailSchema should validate and lowercase', async () => {
    const { emailSchema } = await import('../src/lib/validators');

    const result = emailSchema.safeParse('Test@Example.COM');
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data, 'test@example.com');
    }
  });

  it('emailSchema should reject invalid email', async () => {
    const { emailSchema } = await import('../src/lib/validators');
    assert.equal(emailSchema.safeParse('not-email').success, false);
    assert.equal(emailSchema.safeParse('').success, false);
  });

  it('passwordSchema should require 8 chars', async () => {
    const { passwordSchema } = await import('../src/lib/validators');

    assert.equal(passwordSchema.safeParse('short').success, false);
    assert.equal(passwordSchema.safeParse('exactly8').success, true);
    assert.equal(passwordSchema.safeParse('longpassword123').success, true);
  });

  it('uuidSchema should validate UUID v4', async () => {
    const { uuidSchema } = await import('../src/lib/validators');

    assert.equal(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success, true);
    assert.equal(uuidSchema.safeParse('not-a-uuid').success, false);
    assert.equal(uuidSchema.safeParse('').success, false);
  });

  it('paginationSchema should apply defaults', async () => {
    const { paginationSchema } = await import('../src/lib/validators');

    const result = paginationSchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.page, 1);
      assert.equal(result.data.limit, 20);
    }
  });

  it('paginationSchema should coerce string numbers', async () => {
    const { paginationSchema } = await import('../src/lib/validators');

    const result = paginationSchema.safeParse({ page: '2', limit: '50' });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.page, 2);
      assert.equal(result.data.limit, 50);
    }
  });
});
