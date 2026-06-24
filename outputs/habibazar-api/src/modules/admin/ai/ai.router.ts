import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AssistantCategory, Locale } from '../../../lib/enums';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { ok, noContent, paginated } from '../../../lib/http';
import { paginationSchema } from '../../../lib/validators';
import * as aiAdminService from './ai.service';

const router = Router();

const listQuerySchema = paginationSchema.extend({
  category: z.nativeEnum(AssistantCategory).optional(),
  locale: z.nativeEnum(Locale).optional(),
  dateFrom: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  dateTo: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

// GET /admin/ai/conversations
router.get(
  '/conversations',
  validate(listQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, category, locale, dateFrom, dateTo } =
        req.query as unknown as z.infer<typeof listQuerySchema>;

      const result = await aiAdminService.listConversations(page, limit, {
        category,
        locale,
        dateFrom,
        dateTo,
      });
      paginated(res, result.conversations, result.meta);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/ai/conversations/:id
router.get(
  '/conversations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await aiAdminService.getConversationById((req.params['id'] as string));
      ok(res, conversation);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/ai/conversations/:id
router.delete(
  '/conversations/:id',
  authorize('ai:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await aiAdminService.deleteConversation((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/ai/analytics
router.get(
  '/analytics',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await aiAdminService.getAiAnalytics();
      ok(res, analytics);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
