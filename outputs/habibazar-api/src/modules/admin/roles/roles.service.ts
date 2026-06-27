import { z } from 'zod';
import prisma from '../../../db/prisma';
import { NotFoundError, ConflictError } from '../../../lib/errors';
import { Permission } from '../../../lib/rbac';

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true } },
    },
  });

  return roles.map((r: any) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions,
    userCount: r._count.users,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findFirst({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  });

  if (!role) throw new NotFoundError('Role');

  return {
    id: role.id,
    name: role.name,
    permissions: role.permissions,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function createRole(data: z.infer<typeof createRoleSchema>) {
  const existing = await prisma.role.findFirst({ where: { name: data.name } });
  if (existing) throw new ConflictError('Role with this name already exists');

  return prisma.role.create({
    data: {
      name: data.name,
      permissions: data.permissions,
    },
  });
}

export async function updateRole(id: string, data: z.infer<typeof updateRoleSchema>) {
  const role = await prisma.role.findFirst({ where: { id } });
  if (!role) throw new NotFoundError('Role');

  if (data.name && data.name !== role.name) {
    const existing = await prisma.role.findFirst({ where: { name: data.name, id: { not: id } } });
    if (existing) throw new ConflictError('Role name already in use');
  }

  return prisma.role.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findFirst({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new NotFoundError('Role');

  if (role._count.users > 0) {
    throw new ConflictError(`Cannot delete role with ${role._count.users} assigned users`);
  }

  await prisma.role.delete({ where: { id } });
}

export { createRoleSchema, updateRoleSchema };
