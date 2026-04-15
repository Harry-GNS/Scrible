import { createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();

type TokenType = 'access' | 'refresh';

type TokenBasePayload = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
};

export type AuthTokenPayload = TokenBasePayload & {
  tokenType: TokenType;
  iat: number;
  exp: number;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
};

const accessSecret = process.env.AUTH_ACCESS_TOKEN_SECRET ?? 'dev-access-secret-change-me';
const refreshSecret = process.env.AUTH_REFRESH_TOKEN_SECRET ?? 'dev-refresh-secret-change-me';
const accessTtlSeconds = parsePositiveInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 15 * 60);
const refreshTtlSeconds = parsePositiveInt(
  process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  30 * 24 * 60 * 60
);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signMessage(message: string, secret: string): string {
  return createHmac('sha256', encoder.encode(secret)).update(message).digest('base64url');
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  return timingSafeEqual(aBytes, bBytes);
}

function createJwt(payload: AuthTokenPayload, secret: string): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = signMessage(signingInput, secret);
  return `${signingInput}.${signature}`;
}

function decodeAndVerifyJwt(token: string, secret: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, bodyPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${bodyPart}`;
  const expectedSignature = signMessage(signingInput, secret);

  if (!timingSafeEqualStrings(signaturePart, expectedSignature)) {
    return null;
  }

  try {
    const header = JSON.parse(fromBase64Url(headerPart)) as { alg?: string; typ?: string };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(bodyPart)) as AuthTokenPayload;
    if (!payload?.sub || !payload?.exp || !payload?.iat) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function buildPayload(base: TokenBasePayload, tokenType: TokenType, ttlSeconds: number): AuthTokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    ...base,
    tokenType,
    iat: now,
    exp: now + ttlSeconds
  };
}

export function issueTokenPair(user: TokenBasePayload): TokenPair {
  const accessPayload = buildPayload(user, 'access', accessTtlSeconds);
  const refreshPayload = buildPayload(user, 'refresh', refreshTtlSeconds);

  return {
    accessToken: createJwt(accessPayload, accessSecret),
    refreshToken: createJwt(refreshPayload, refreshSecret),
    accessTokenExpiresInSeconds: accessTtlSeconds,
    refreshTokenExpiresInSeconds: refreshTtlSeconds
  };
}

export function verifyAccessToken(token: string): AuthTokenPayload | null {
  const payload = decodeAndVerifyJwt(token, accessSecret);
  if (!payload || payload.tokenType !== 'access') {
    return null;
  }
  return payload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload | null {
  const payload = decodeAndVerifyJwt(token, refreshSecret);
  if (!payload || payload.tokenType !== 'refresh') {
    return null;
  }
  return payload;
}
