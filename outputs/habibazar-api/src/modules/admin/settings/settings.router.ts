import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok } from '../../../lib/http';
import * as settingsService from './settings.service';

const router = Router();

const upsertSchema = z.object({
  value: z.string().min(0).max(10000),
});

// GET /admin/settings
router.get(
  '/',
  authorize('settings:read'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await settingsService.listSettings();
      ok(res, settings);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /admin/settings/:key
router.put(
  '/:key',
  authorize('settings:write'),
  validate(upsertSchema),
  auditLog('upsert', 'setting'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = req.params;
      const { value } = req.body as z.infer<typeof upsertSchema>;
      const setting = await settingsService.upsertSetting(req.params.key as string, value);
      ok(res, setting);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
