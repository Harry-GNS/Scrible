/* eslint-disable no-console */

import "dotenv/config";
import { createHmac } from "node:crypto";

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const verbose = process.argv.includes('--verbose');
const ACCESS_SECRET = process.env.AUTH_ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';
const TOKEN_ISSUER = process.env.AUTH_TOKEN_ISSUER || 'scrible-backend';

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createAccessTokenForUser(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      email: `${userId}@smoke.local`,
      name: "Smoke User",
      picture: "",
      provider: "smoke",
      iss: TOKEN_ISSUER,
      tokenType: "access",
      iat: now,
      exp: now + 15 * 60
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", ACCESS_SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function logStep(message) {
  console.log(`[smoke] ${message}`);
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

  if (verbose) {
    logStep(`${init?.method || 'GET'} ${path} -> ${response.status}`);
  }

  return { response, body };
}

async function run() {
  logStep(`Running smoke tests against ${BASE_URL}`);

  const health = await request('/health');
  assert(health.response.status === 200, '/health should return 200');
  assert(health.body?.status === 'ok', '/health status should be ok');

  const storageConfig = await request('/storage/config');
  assert(storageConfig.response.status === 200, '/storage/config should return 200');
  const storageEnabled = Boolean(storageConfig.body?.configured);

  const userId = `smoke-${Date.now()}`;
  const duration = 1;
  const accessToken = createAccessTokenForUser(userId);
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };

  const claim = await request('/drawing/claim', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ duration })
  });
  assert(claim.response.status === 201, '/drawing/claim should return 201 for a new user/day/duration');

  const eligibility = await request(`/drawing/eligibility?duration=${duration}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  assert(eligibility.response.status === 200, '/drawing/eligibility should return 200');
  assert(eligibility.body?.allowed === false, 'eligibility should be false after claiming same day/duration');

  const myArtworks = await request(`/drawing/my-artworks?limit=10`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  assert(myArtworks.response.status === 200, '/drawing/my-artworks should return 200');

  const gallery = await request(`/drawing/gallery?duration=${duration}&limit=25`);
  assert(gallery.response.status === 200, '/drawing/gallery should return 200');

  const authMismatchClaim = await request('/drawing/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.token.value'
    },
    body: JSON.stringify({ duration: 5 })
  });
  assert(authMismatchClaim.response.status === 401, '/drawing/claim should reject invalid access token');

  const authMismatchPresign = await request('/storage/presign-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.token.value'
    },
    body: JSON.stringify({
      duration,
      contentType: 'image/webp',
      fileSizeBytes: 123
    })
  });
  assert(authMismatchPresign.response.status === 401, '/storage/presign-upload should reject invalid access token');

  if (storageEnabled) {
    const fakeBytes = 12;
    const finalize = await request('/drawing/finalize-upload', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        duration,
        publicUrl: 'https://example.com/not-real.webp',
        objectKey: 'artworks/non-existent/object.webp',
        minBytes: fakeBytes,
        signatureName: 'smoke'
      })
    });

    assert(finalize.response.status === 409, '/drawing/finalize-upload should reject non-existent cloud objects with 409');
  } else {
    logStep('Storage is not configured; finalize-upload cloud verification check skipped');
  }

  logStep('Smoke tests passed');
}

run().catch((error) => {
  console.error(`[smoke] FAILED: ${error.message}`);
  process.exitCode = 1;
});
