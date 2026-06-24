import { z } from 'zod';
import { UserStatus } from '../../../lib/enums';
import prisma from '../../../db/prisma';
import { hashPassword, generateToken } from '../../../lib/crypto';
import { NotFoundError, ConflictError } from '../../../lib/errors';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../../lib/pagination';
import { emailSchema, passwordSchema } from '../../../lib/validators';

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(255),
  roleId: z.string().uuid(),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: emailSchema.optional(),
  roleId: z.string().uuid().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export async function listUsers(page: number, limit: number) {
  const where = { deletedAt: null };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      ...buildPrismaSkipTake(page, limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { users, meta: buildPaginationMeta(total, page, limit) };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (!user) throw new NotFoundError('User');
  return user;
}

export async function createUser(data: z.infer<typeof createUserSchema>) {
  const existing = await prisma.user.findFirst({
    where: { email: data.email, deletedAt: null },
  });
  if (existing) throw new ConflictError('User with this email already exists');

  const role = await prisma.role.findFirst({ where: { id: data.roleId } });
  if (!role) throw new NotFoundError('Role');

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      roleId: data.roleId,
      status: data.status,
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  });

  return user;
}

export async function updateUser(id: string, data: z.infer<typeof updateUserSchema>) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User');

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null, id: { not: id } },
    });
    if (existing) throw new ConflictError('Email already in use');
  }

  if (data.roleId) {
    const role = await prisma.role.findFirst({ where: { id: data.roleId } });
    if (!role) throw new NotFoundError('Role');
  }

  return prisma.user.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      updatedAt: true,
      role: { select: { id: true, name: true } },
    },
  });
}

export async function softDeleteUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User');

  // Revoke all sessions
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: UserStatus.INACTIVE },
  });
}

export async function resetPassword(id: string): Promise<{ tempPassword: string }> {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User');

  const tempPassword = generateToken().slice(0, 16);
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  // Revoke all sessions to force re-login
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { tempPassword };
}

export { createUserSchema, updateUserSchema };
