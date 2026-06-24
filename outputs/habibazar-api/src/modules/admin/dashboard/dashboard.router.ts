import { Router, Request, Response, NextFunction } from 'express';
import { ok } from '../../../lib/http';
import * as dashboardService from './dashboard.service';

const router = Router();

// GET /admin/dashboard
router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await dashboardService.getDashboardStats();
      ok(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
