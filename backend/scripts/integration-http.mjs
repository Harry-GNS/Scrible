/* eslint-disable no-console */

import 'dotenv/config';
import { createHmac } from 'node:crypto';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const ACCESS_SECRET = process.env.AUTH_ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';
const TOKEN_ISSUER = process.env.AUTH_TOKEN_ISSUER || 'scrible-backend';

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createAccessTokenForUser(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      email: `${userId}@integration.local`,
      name: 'Integration User',
      picture: '',
      provider: 'integration',
      iss: TOKEN_ISSUER,
      tokenType: 'access',
      iat: now,
      exp: now + 15 * 60
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', ACCESS_SECRET).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const raw = await response.text();

  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return { response, body };
}

async function run() {
  console.log(`[integration-http] Running against ${BASE_URL}`);

  const health = await request('/health');
  assert(health.response.status === 200, '/health should return 200');
  assert(health.body?.status === 'ok', '/health should return status=ok');

  const routeNotFound = await request('/__missing_route__');
  assert(routeNotFound.response.status === 404, 'unknown route should return 404');
  assert(routeNotFound.body?.code === 'ROUTE_NOT_FOUND', '404 response should include ROUTE_NOT_FOUND code');

  const corsBlocked = await request('/health', {
    method: 'GET',
    headers: {
      Origin: 'https://blocked-origin.example'
    }
  });
  assert(corsBlocked.response.status === 403, 'blocked CORS origin should return 403');
  assert(
    corsBlocked.body?.code === 'CORS_ORIGIN_NOT_ALLOWED',
    'blocked CORS response should include CORS_ORIGIN_NOT_ALLOWED code'
  );

  const authRequired = await request('/drawing/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ duration: 1 })
  });
  assert(authRequired.response.status === 401, 'claim without token should return 401');
  assert(authRequired.body?.code === 'MISSING_BEARER_TOKEN', 'claim without token should include MISSING_BEARER_TOKEN code');

  const invalidToken = await request('/storage/presign-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.token.payload'
    },
    body: JSON.stringify({
      duration: 1,
      contentType: 'image/webp',
      fileSizeBytes: 120
    })
  });
  assert(invalidToken.response.status === 401, 'presign with invalid token should return 401');
  assert(invalidToken.body?.code === 'INVALID_ACCESS_TOKEN', 'presign with invalid token should include INVALID_ACCESS_TOKEN code');

  const userId = `integration-${Date.now()}`;
  const accessToken = createAccessTokenForUser(userId);
  const claim = await request('/drawing/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ duration: 1 })
  });
  assert(claim.response.status === 201, 'claim with valid token should return 201');

  const myArtworks = await request('/drawing/my-artworks?limit=10', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  assert(myArtworks.response.status === 200, 'my-artworks with valid token should return 200');

  const gallery = await request('/drawing/gallery?duration=999');
  assert(gallery.response.status === 400, 'gallery with invalid duration should return 400');

  console.log('[integration-http] Integration HTTP tests passed');
}

run().catch((error) => {
  console.error(`[integration-http] FAILED: ${error.message}`);
  process.exitCode = 1;
});
