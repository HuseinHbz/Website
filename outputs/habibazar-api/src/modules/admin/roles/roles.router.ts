import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../../middleware/validate';
import { authorize } from '../../../middleware/authorize';
import { auditLog } from '../../../middleware/audit';
import { ok, created, noContent } from '../../../lib/http';
import * as rolesService from './roles.service';

const router = Router();

// GET /admin/roles
router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await rolesService.listRoles();
      ok(res, roles);
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/roles/:id
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await rolesService.getRoleById((req.params['id'] as string));
      ok(res, role);
    } catch (err) {
      next(err);
    }
  },
);

// POST /admin/roles
router.post(
  '/',
  authorize('role:write'),
  validate(rolesService.createRoleSchema),
  auditLog('create', 'role'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await rolesService.createRole(req.body);
      res.locals['createdId'] = role.id;
      created(res, role);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /admin/roles/:id
router.patch(
  '/:id',
  authorize('role:write'),
  validate(rolesService.updateRoleSchema),
  auditLog('update', 'role'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await rolesService.updateRole((req.params['id'] as string), req.body);
      ok(res, role);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /admin/roles/:id
router.delete(
  '/:id',
  authorize('role:write'),
  auditLog('delete', 'role'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rolesService.deleteRole((req.params['id'] as string));
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
