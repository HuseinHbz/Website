import { Request, Response, NextFunction } from 'express';
import { generateToken } from '../lib/crypto';
import { ForbiddenError } from '../lib/errors';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip CSRF for Bearer-authenticated requests (APIs using tokens don't need CSRF)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  if (SAFE_METHODS.has(req.method)) {
    // On GET: issue a CSRF token if not already set
    if (!req.cookies[CSRF_COOKIE]) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // Must be readable by JS
        sameSite: 'strict',
        secure: process.env['NODE_ENV'] === 'production',
        maxAge: 3600 * 1000, // 1 hour
      });
    }
    return next();
  }

  // For mutations: validate the token
  const cookieToken = req.cookies[CSRF_COOKIE] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new ForbiddenError('Invalid CSRF token'));
  }

  next();
}
