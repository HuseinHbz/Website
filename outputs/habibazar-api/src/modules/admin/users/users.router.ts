import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok, created, noContent, paginated } from '../../../lib/http';
import { paginationSchema } from '../../../lib/validators';
import * as usersService from './users.service';

const router = Router();

// GET /admin/users
router.get(
  '/',
  validate(paginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await usersService.listUsers(page, limit);
      paginated(res, result.users, result.meta);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/users/:id
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getUserById((req.params['id'] as string));
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/users
router.post(
  '/',
  authorize('user:write'),
  validate(usersService.createUserSchema),
  auditLog('create', 'user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.createUser(req.body);
      res.locals['createdId'] = user.id;
      created(res, user);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/users/:id
router.patch(
  '/:id',
  authorize('user:write'),
  validate(usersService.updateUserSchema),
  auditLog('update', 'user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateUser((req.params['id'] as string), req.body);
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/users/:id
router.delete(
  '/:id',
  authorize('user:write'),
  auditLog('delete', 'user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await usersService.softDeleteUser((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/users/:id/reset-password
router.post(
  '/:id/reset-password',
  authorize('user:write'),
  auditLog('reset-password', 'user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await usersService.resetPassword((req.params['id'] as string));
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
