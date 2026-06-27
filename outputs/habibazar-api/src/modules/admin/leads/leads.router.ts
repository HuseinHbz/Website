import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok, created, noContent, paginated } from '../../../lib/http';
import { paginationSchema, uuidSchema } from '../../../lib/validators';
import * as leadsService from './leads.service';
import { LeadStatus, LeadSource } from '../../../lib/enums';

const router = Router();

const listQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  search: z.string().max(255).optional(),
});

// GET /admin/leads
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, source, search } = req.query as unknown as z.infer<typeof listQuerySchema>;
      const { leads, meta } = await leadsService.listLeads(page, limit, { status, source, search });
      paginated(res, leads, meta);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/leads/:id
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await leadsService.getLeadById((req.params['id'] as string));
      ok(res, lead);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/leads/:id
router.patch(
  '/:id',
  authorize('lead:write'),
  validate(leadsService.updateLeadSchema),
  auditLog('update', 'lead'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await leadsService.updateLead((req.params['id'] as string), req.body);
      ok(res, lead);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/leads/:id
router.delete(
  '/:id',
  authorize('lead:delete'),
  auditLog('delete', 'lead'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await leadsService.softDeleteLead((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/leads/:id/events
router.post(
  '/:id/events',
  authorize('lead:write'),
  validate(leadsService.leadEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await leadsService.addLeadEvent((req.params['id'] as string), req.body);
      created(res, event);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
