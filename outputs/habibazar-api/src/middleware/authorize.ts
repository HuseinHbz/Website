import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { Permission } from '../lib/rbac';

export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userPermissions = req.user.role.permissions;
    const hasAll = permissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      return next(
        new ForbiddenError(
          `Missing required permissions: ${permissions.filter((p) => !userPermissions.includes(p)).join(', ')}`,
        ),
      );
    }

    next();
  };
}
