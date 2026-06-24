import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok, created, noContent, paginated } from '../../../lib/http';
import { paginationSchema } from '../../../lib/validators';
import * as engagementsService from './engagements.service';
import { EngagementStage } from '../../../lib/enums';

const router = Router();

const listQuerySchema = paginationSchema.extend({
  stage: z.nativeEnum(EngagementStage).optional(),
});

// GET /admin/engagements
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, stage } = req.query as unknown as z.infer<typeof listQuerySchema>;
      const result = await engagementsService.listEngagements(page, limit, { stage });
      paginated(res, result.engagements, result.meta);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/engagements/:id
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const engagement = await engagementsService.getEngagementById((req.params['id'] as string));
      ok(res, engagement);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/engagements
router.post(
  '/',
  authorize('engagement:write'),
  validate(engagementsService.createEngagementSchema),
  auditLog('create', 'engagement'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const engagement = await engagementsService.createEngagement(req.body);
      res.locals['createdId'] = engagement.id;
      created(res, engagement);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/engagements/:id
router.patch(
  '/:id',
  authorize('engagement:write'),
  validate(engagementsService.updateEngagementSchema),
  auditLog('update', 'engagement'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const engagement = await engagementsService.updateEngagement((req.params['id'] as string), req.body);
      ok(res, engagement);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/engagements/:id
router.delete(
  '/:id',
  authorize('engagement:write'),
  auditLog('delete', 'engagement'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await engagementsService.deleteEngagement((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
