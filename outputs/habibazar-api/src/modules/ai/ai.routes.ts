import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { publicLimiter, aiLimiter } from '../../middleware/rateLimit';
import { ok, created } from '../../lib/http';
import { intakeSchema, chatMessageSchema } from './ai.schemas';
import * as aiService from './ai.service';
import logger from '../../lib/logger';

const router = Router();

// POST /ai/conversations - Start a conversation
router.post(
  '/conversations',
  publicLimiter,
  aiLimiter,
  validate(intakeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await aiService.startConversation(req.body);
      created(res, {
        id: conversation.id,
        locale: conversation.locale,
        turnCount: conversation.turnCount,
        createdAt: conversation.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /ai/conversations/:id/messages - Stream chat response (SSE)
router.post(
  '/conversations/:id/messages',
  publicLimiter,
  aiLimiter,
  validate(chatMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { message, locale } = req.body as { message: string; locale: 'FA' | 'EN' };

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Helper to send SSE events
    const sendEvent = (data: unknown) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      const stream = aiService.chat(req.params.id as string, message, locale ?? 'FA');

      for await (const chunk of stream) {
        sendEvent({ type: 'delta', content: chunk });
      }

      sendEvent({ type: 'done' });
      res.end();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      logger.error({ err, conversationId: id }, 'AI chat error');
      sendEvent({ type: 'error', message: errorMessage });
      res.end();
    }
  },
);

export default router;
