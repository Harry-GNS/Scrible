import type { Request } from 'express';

import { verifyAccessToken } from './auth-token.js';

export type ResolvedIdentity = {
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
  userId?: string;
  authenticated: boolean;
};

type ResolveIdentityOptions = {
  requireAuth?: boolean;
};

function getBearerToken(headerValue: string | undefined): string {
  const raw = String(headerValue ?? '').trim();
  if (!raw.startsWith('Bearer ')) {
    return '';
  }

  return raw.slice('Bearer '.length).trim();
}

export function resolveIdentity(
  req: Request,
  providedUserId: string,
  options: ResolveIdentityOptions = {}
): ResolvedIdentity {
  const requireAuth = options.requireAuth === true;
  const userIdInput = providedUserId.trim();
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    if (requireAuth) {
      return {
        ok: false,
        status: 401,
        code: 'MISSING_BEARER_TOKEN',
        message: 'missing bearer token',
        authenticated: false
      };
    }

    if (!userIdInput) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_USER_ID',
        message: 'userId is required when Authorization header is missing',
        authenticated: false
      };
    }

    return {
      ok: true,
      userId: userIdInput,
      authenticated: false
    };
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_ACCESS_TOKEN',
      message: 'invalid access token',
      authenticated: true
    };
  }

  if (userIdInput && userIdInput !== payload.sub) {
    return {
      ok: false,
      status: 403,
      code: 'USER_ID_MISMATCH',
      message: 'userId does not match authenticated token',
      authenticated: true
    };
  }

  return {
    ok: true,
    userId: payload.sub,
    authenticated: true
  };
}
