import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { paginated } from '../../../lib/http';
import { paginationSchema, uuidSchema } from '../../../lib/validators';
import * as auditService from './audit.service';

const router = Router();

const listQuerySchema = paginationSchema.extend({
  resource: z.string().max(100).optional(),
  userId: uuidSchema.optional(),
  action: z.string().max(100).optional(),
  dateFrom: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  dateTo: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

// GET /admin/audit
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, resource, userId, action, dateFrom, dateTo } =
        req.query as unknown as z.infer<typeof listQuerySchema>;

      const result = await auditService.listAuditLogs(page, limit, {
        resource,
        userId,
        action,
        dateFrom,
        dateTo,
      });

      paginated(res, result.logs, result.meta);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
