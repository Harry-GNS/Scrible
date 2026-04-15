import jwt from 'jsonwebtoken';

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
const accessPreviousSecrets = parseSecretList(process.env.AUTH_ACCESS_TOKEN_PREVIOUS_SECRETS);
const refreshPreviousSecrets = parseSecretList(process.env.AUTH_REFRESH_TOKEN_PREVIOUS_SECRETS);
const accessTtlSeconds = parsePositiveInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 15 * 60);
const refreshTtlSeconds = parsePositiveInt(
  process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  30 * 24 * 60 * 60
);
const tokenIssuer = process.env.AUTH_TOKEN_ISSUER ?? 'scrible-backend';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function parseSecretList(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createJwt(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    noTimestamp: true,
    issuer: tokenIssuer
  });
}

function decodeAndVerifyJwt(token: string, secret: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: tokenIssuer
    });

    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const payload = decoded as AuthTokenPayload;
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

function decodeAndVerifyWithFallback(token: string, currentSecret: string, previousSecrets: string[]): AuthTokenPayload | null {
  const withCurrent = decodeAndVerifyJwt(token, currentSecret);
  if (withCurrent) {
    return withCurrent;
  }

  for (const previousSecret of previousSecrets) {
    const withPrevious = decodeAndVerifyJwt(token, previousSecret);
    if (withPrevious) {
      return withPrevious;
    }
  }

  return null;
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
  const payload = decodeAndVerifyWithFallback(token, accessSecret, accessPreviousSecrets);
  if (!payload || payload.tokenType !== 'access') {
    return null;
  }
  return payload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload | null {
  const payload = decodeAndVerifyWithFallback(token, refreshSecret, refreshPreviousSecrets);
  if (!payload || payload.tokenType !== 'refresh') {
    return null;
  }
  return payload;
}
