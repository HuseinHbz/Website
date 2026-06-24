import { Router, Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { ContentStatus } from '../../lib/enums';
import prisma from '../../db/prisma';
import { validate } from '../../middleware/validate';
import { authorize } from '../../middleware/authorize';
import { auditLog } from '../../middleware/audit';
import { ok, created, noContent, paginated } from '../../lib/http';
import { paginationSchema } from '../../lib/validators';
import { buildPaginationMeta, buildPrismaSkipTake } from '../../lib/pagination';
import { NotFoundError } from '../../lib/errors';
import { Permission } from '../../lib/rbac';

type PrismaModelName = string;

interface ContentFactoryOptions {
  softDelete?: boolean;
  searchFields?: string[];
  extraWritePermission?: Permission;
  extraDeletePermission?: Permission;
  includeRelations?: Record<string, boolean | object>;
  listSelect?: Record<string, boolean>;
}

const listQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ContentStatus).optional(),
  search: z.string().max(255).optional(),
  featured: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaModel = any;

function getModel(modelName: PrismaModelName): AnyPrismaModel {
  return (prisma as unknown as Record<string, AnyPrismaModel>)[modelName as string];
}

export function createContentRouter(
  modelName: PrismaModelName,
  createSchema: ZodSchema,
  updateSchema: ZodSchema,
  options: ContentFactoryOptions = {},
): Router {
  const router = Router();
  const model = getModel(modelName);
  const {
    softDelete = true,
    searchFields = ['slug'],
    includeRelations,
    listSelect,
  } = options;

  // GET /
  router.get(
    '/',
    validate(listQuerySchema, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { page, limit, status, search, featured } = req.query as unknown as z.infer<typeof listQuerySchema>;

        const where: Record<string, unknown> = {};
        if (softDelete) where['deletedAt'] = null;
        if (status) where['status'] = status;
        if (featured !== undefined) where['featured'] = featured;

        if (search && searchFields.length > 0) {
          where['OR'] = searchFields.map((field) => ({
            [field]: { contains: search, mode: 'insensitive' },
          }));
        }

        const [total, items] = await Promise.all([
          model.count({ where }),
          model.findMany({
            where,
            ...buildPrismaSkipTake(page, limit),
            orderBy: { createdAt: 'desc' },
            ...(listSelect ? { select: listSelect } : {}),
            ...(includeRelations && !listSelect ? { include: includeRelations } : {}),
          }),
        ]);

        paginated(res, items, buildPaginationMeta(total, page, limit));
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /:id
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const where: Record<string, unknown> = { id: req.params['id'] };
        if (softDelete) where['deletedAt'] = null;

        const item = await model.findFirst({
          where,
          ...(includeRelations ? { include: includeRelations } : {}),
        });

        if (!item) throw new NotFoundError(String(modelName));
        ok(res, item);
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /
  router.post(
    '/',
    authorize('content:write'),
    validate(createSchema),
    auditLog('create', String(modelName)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const item = await model.create({ data: req.body });

        // Save content version
        await prisma.contentVersion.create({
          data: {
            resource: String(modelName),
            resourceId: item.id,
            data: item,
            authorId: req.user?.id ?? null,
          },
        }).catch(() => { /* non-blocking */ });

        res.locals['createdId'] = item.id;
        created(res, item);
      } catch (err) {
        next(err);
      }
    },
  );

  // PUT /:id
  router.put(
    '/:id',
    authorize('content:write'),
    validate(updateSchema),
    auditLog('update', String(modelName)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const where: Record<string, unknown> = { id: req.params['id'] };
        if (softDelete) {
          const existing = await model.findFirst({ where: { ...where, deletedAt: null } });
          if (!existing) throw new NotFoundError(String(modelName));
        }

        const item = await model.update({
          where: { id: req.params['id'] },
          data: { ...req.body, updatedAt: new Date() },
        });

        // Save content version
        await prisma.contentVersion.create({
          data: {
            resource: String(modelName),
            resourceId: item.id,
            data: item,
            authorId: req.user?.id ?? null,
          },
        }).catch(() => { /* non-blocking */ });

        ok(res, item);
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /:id
  router.delete(
    '/:id',
    authorize('content:delete'),
    auditLog('delete', String(modelName)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const where: Record<string, unknown> = { id: req.params['id'] };
        if (softDelete) where['deletedAt'] = null;

        const existing = await model.findFirst({ where });
        if (!existing) throw new NotFoundError(String(modelName));

        if (softDelete) {
          await model.update({
            where: { id: req.params['id'] },
            data: { deletedAt: new Date() },
          });
        } else {
          await model.delete({ where: { id: req.params['id'] } });
        }

        noContent(res);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
