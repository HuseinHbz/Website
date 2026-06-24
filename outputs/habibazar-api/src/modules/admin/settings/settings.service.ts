import prisma from '../../../db/prisma';

export async function listSettings() {
  return prisma.setting.findMany({
    orderBy: { key: 'asc' },
    select: { id: true, key: true, value: true, updatedAt: true },
  });
}

export async function upsertSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getSettingByKey(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}
