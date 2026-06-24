import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../lib/errors';
import { getClientIp } from '../lib/req';
import logger from '../lib/logger';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

// In-memory store (replace with Redis for multi-instance deployments)
const store = new Map<string, RateLimitStore>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const key = `${ip}:${req.path}:${maxRequests}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      logger.warn({ ip, path: req.path }, 'Rate limit exceeded');
      return next(new TooManyRequestsError(`Rate limit: ${maxRequests} requests per ${windowMs / 1000}s`));
    }

    entry.count++;
    next();
  };
}

// 5 requests per minute for auth endpoints
export const authLimiter = createRateLimiter(5, 60_000);

// 30 requests per minute for public endpoints
export const publicLimiter = createRateLimiter(30, 60_000);

// 10 requests per minute for AI endpoints
export const aiLimiter = createRateLimiter(10, 60_000);

// 100 requests per minute for general API
export const apiLimiter = createRateLimiter(100, 60_000);
