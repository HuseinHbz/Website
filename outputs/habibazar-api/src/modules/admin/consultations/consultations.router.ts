import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok, noContent, paginated } from '../../../lib/http';
import { paginationSchema } from '../../../lib/validators';
import * as consultationsService from './consultations.service';
import { ConsultationStatus, ConsultationKind } from '../../../lib/enums';

const router = Router();

const listQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ConsultationStatus).optional(),
  kind: z.nativeEnum(ConsultationKind).optional(),
});

// GET /admin/consultations
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, kind } = req.query as unknown as z.infer<typeof listQuerySchema>;
      const result = await consultationsService.listConsultations(page, limit, { status, kind });
      paginated(res, result.consultations, result.meta);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/consultations/:id
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consultation = await consultationsService.getConsultationById((req.params['id'] as string));
      ok(res, consultation);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/consultations/:id
router.patch(
  '/:id',
  authorize('consultation:write'),
  validate(consultationsService.updateConsultationSchema),
  auditLog('update', 'consultation'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await consultationsService.updateConsultation((req.params['id'] as string), req.body);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/consultations/:id
router.delete(
  '/:id',
  authorize('consultation:write'),
  auditLog('delete', 'consultation'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await consultationsService.softDeleteConsultation((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
