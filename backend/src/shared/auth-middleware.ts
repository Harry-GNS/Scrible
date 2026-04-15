import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from './auth-token.js';

function getBearerToken(headerValue: string | undefined): string {
  const raw = String(headerValue ?? '').trim();
  if (!raw.startsWith('Bearer ')) {
    return '';
  }

  return raw.slice('Bearer '.length).trim();
}

export function requireAuthenticatedRequest(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      code: 'MISSING_BEARER_TOKEN',
      message: 'missing bearer token'
    });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload?.sub) {
    res.status(401).json({
      code: 'INVALID_ACCESS_TOKEN',
      message: 'invalid access token'
    });
    return;
  }

  res.locals.authUserId = payload.sub;
  next();
}

export function getAuthenticatedUserId(res: Response): string {
  return String(res.locals.authUserId ?? '').trim();
}

export function rejectIfUserMismatch(res: Response, providedUserId: string): boolean {
  const authenticatedUserId = getAuthenticatedUserId(res);
  const provided = String(providedUserId ?? '').trim();

  if (!provided || !authenticatedUserId) {
    return false;
  }

  if (provided === authenticatedUserId) {
    return false;
  }

  res.status(403).json({
    code: 'USER_ID_MISMATCH',
    message: 'userId does not match authenticated token'
  });
  return true;
}
