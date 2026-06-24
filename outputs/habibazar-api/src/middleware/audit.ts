import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma';
import logger from '../lib/logger';
import { getClientIp } from '../lib/req';

export function auditLog(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Capture original end to hook after response
    const originalEnd = res.end.bind(res);

    // @ts-expect-error - overriding end with extended signature
    res.end = function (...args: Parameters<typeof res.end>) {
      // Call original end first
      const result = originalEnd(...args);

      // Fire and forget audit log
      const resourceId =
        req.params['id'] || (res.locals['createdId'] as string | undefined);

      prisma.auditLog
        .create({
          data: {
            userId: req.user?.id ?? null,
            action,
            resource,
            resourceId: resourceId ?? null,
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
            },
            ipAddress: getClientIp(req),
          },
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Failed to write audit log');
        });

      return result;
    };

    next();
  };
}
