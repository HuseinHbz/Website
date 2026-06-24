import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter } from '../../middleware/rateLimit';
import * as authService from './auth.service';
import { ok, created } from '../../lib/http';
import { emailSchema, passwordSchema } from '../../lib/validators';
import { getClientIp } from '../../lib/req';

const router = Router();

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  totpToken: z.string().length(6).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const totpVerifySchema = z.object({
  token: z.string().length(6, 'TOTP token must be 6 digits'),
});

// POST /auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, totpToken } = req.body as z.infer<typeof loginSchema>;
      const result = await authService.login(
        email,
        password,
        totpToken,
        req.headers['user-agent'],
        getClientIp(req),
      );
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/refresh
router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
      const result = await authService.refresh(refreshToken);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/logout
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body as z.infer<typeof logoutSchema>;
      await authService.logout(req.user!.id, refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// GET /auth/me
router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/2fa/setup
router.post(
  '/2fa/setup',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.setup2fa(req.user!.id);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/2fa/verify
router.post(
  '/2fa/verify',
  authenticate,
  validate(totpVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body as z.infer<typeof totpVerifySchema>;
      await authService.verify2fa(req.user!.id, token);
      ok(res, { message: 'Two-factor authentication enabled' });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /auth/2fa
router.delete(
  '/2fa',
  authenticate,
  validate(totpVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body as z.infer<typeof totpVerifySchema>;
      await authService.disable2fa(req.user!.id, token);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
