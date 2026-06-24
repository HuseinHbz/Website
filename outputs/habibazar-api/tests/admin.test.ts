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

describe('RBAC permissions', async () => {
  it('should export all required permissions', async () => {
    const { PERMISSIONS, ALL_PERMISSIONS } = await import('../src/lib/rbac');

    const expectedPermissions = [
      'lead:read', 'lead:write', 'lead:delete',
      'consultation:read', 'consultation:write',
      'engagement:read', 'engagement:write',
      'content:read', 'content:write', 'content:delete',
      'testimonial:approve', 'cert:verify', 'consent:write',
      'user:read', 'user:write',
      'role:read', 'role:write',
      'settings:read', 'settings:write',
      'audit:read',
      'ai:read', 'ai:write',
    ];

    for (const perm of expectedPermissions) {
      assert.ok(perm in PERMISSIONS, `Permission ${perm} should exist`);
    }

    assert.equal(ALL_PERMISSIONS.length, expectedPermissions.length, 'ALL_PERMISSIONS should have correct count');
  });
});

describe('Dashboard service', async () => {
  before(() => {
    const mockPrisma = {
      $connect: async () => {},
      lead: {
        groupBy: async () => [
          { status: 'NEW', _count: { id: 5 } },
          { status: 'QUALIFIED', _count: { id: 3 } },
        ],
        findMany: async () => [
          { id: '1', name: 'Lead 1', email: 'a@b.com', company: null, source: 'WEBSITE', status: 'NEW', score: 10, createdAt: new Date() },
        ],
      },
      consultationRequest: {
        groupBy: async () => [
          { status: 'PENDING', _count: { id: 2 } },
        ],
        findMany: async () => [],
      },
      engagement: {
        aggregate: async () => ({
          _sum: { value: 50000 },
          _count: { id: 2 },
        }),
      },
      conversation: {
        count: async () => 15,
      },
    };

    mock.module('../src/db/prisma', {
      defaultExport: mockPrisma,
      namedExports: { prisma: mockPrisma },
    });
  });

  it('should return dashboard stats', async () => {
    const { getDashboardStats } = await import('../src/modules/admin/dashboard/dashboard.service');
    const stats = await getDashboardStats();

    assert.ok(stats.leads, 'Stats should have leads');
    assert.ok(stats.consultations, 'Stats should have consultations');
    assert.ok(stats.engagementPipeline, 'Stats should have engagementPipeline');
    assert.ok(Array.isArray(stats.recentLeads), 'recentLeads should be array');
    assert.ok(Array.isArray(stats.recentConsultations), 'recentConsultations should be array');
    assert.equal(typeof stats.aiConversationsThisMonth, 'number');
  });
});

describe('Roles service', async () => {
  before(() => {
    const mockPrisma = {
      role: {
        findMany: async () => [
          {
            id: 'role-1',
            name: 'admin',
            permissions: ['lead:read', 'lead:write'],
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { users: 2 },
          },
        ],
        findFirst: async (args: { where: { id?: string; name?: string } }) => {
          if (args.where.name === 'existing-role') {
            return { id: 'r1', name: 'existing-role', permissions: [] };
          }
          return null;
        },
        create: async (args: { data: { name: string; permissions: string[] } }) => ({
          id: 'new-role-id',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async (args: { where: { id: string }; data: unknown }) => ({ id: args.where.id }),
        delete: async () => ({}),
      },
    };

    mock.module('../src/db/prisma', {
      defaultExport: mockPrisma,
      namedExports: { prisma: mockPrisma },
    });
  });

  it('should list roles with user counts', async () => {
    const { listRoles } = await import('../src/modules/admin/roles/roles.service');
    const roles = await listRoles();

    assert.ok(Array.isArray(roles));
    assert.equal(roles.length, 1);
    assert.equal(roles[0]?.userCount, 2);
    assert.ok(Array.isArray(roles[0]?.permissions));
  });

  it('createRoleSchema should validate', async () => {
    const { createRoleSchema } = await import('../src/modules/admin/roles/roles.service');

    const valid = createRoleSchema.safeParse({
      name: 'editor',
      permissions: ['content:read', 'content:write'],
    });
    assert.equal(valid.success, true);

    const invalid = createRoleSchema.safeParse({ name: 'editor', permissions: [] });
    assert.equal(invalid.success, false, 'Empty permissions should fail');
  });
});

describe('Users service schemas', async () => {
  it('createUserSchema should validate', async () => {
    const { createUserSchema } = await import('../src/modules/admin/users/users.service');

    const valid = createUserSchema.safeParse({
      email: 'admin@example.com',
      password: 'SecurePass123',
      name: 'Admin User',
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(valid.success, true);
  });

  it('createUserSchema should reject short password', async () => {
    const { createUserSchema } = await import('../src/modules/admin/users/users.service');

    const result = createUserSchema.safeParse({
      email: 'admin@example.com',
      password: 'short',
      name: 'Admin',
      roleId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(result.success, false);
  });
});
