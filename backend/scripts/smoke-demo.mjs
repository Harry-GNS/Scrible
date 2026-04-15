/* eslint-disable no-console */

import "dotenv/config";
import { createHmac } from "node:crypto";

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const verbose = process.argv.includes('--verbose');
const ACCESS_SECRET = process.env.AUTH_ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createAccessTokenForUser(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      email: `${userId}@demo.local`,
      name: "Demo User",
      picture: "",
      provider: "smoke",
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
  console.log(`[smoke-demo] ${message}`);
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
  logStep(`Running demo smoke against ${BASE_URL}`);

  const health = await request('/health');
  assert(health.response.status === 200, '/health should return 200');

  const storageConfig = await request('/storage/config');
  assert(storageConfig.response.status === 200, '/storage/config should return 200');
  assert(Boolean(storageConfig.body?.configured), 'R2 storage must be configured for demo smoke');

  const userId = `demo-${Date.now()}`;
  const duration = 5;
  const signatureName = 'Demo';
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
  assert(claim.response.status === 201, '/drawing/claim should return 201');

  const payloadBytes = new TextEncoder().encode(`demo-webp-${Date.now()}`);
  const fakeImageBlob = new Blob([payloadBytes], { type: 'image/webp' });

  const presign = await request('/storage/presign-upload', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      duration,
      contentType: 'image/webp',
      fileSizeBytes: fakeImageBlob.size
    })
  });

  assert(presign.response.status === 201, '/storage/presign-upload should return 201');
  assert(typeof presign.body?.uploadUrl === 'string', 'presign response must include uploadUrl');
  assert(typeof presign.body?.publicUrl === 'string', 'presign response must include publicUrl');
  assert(typeof presign.body?.objectKey === 'string', 'presign response must include objectKey');

  const upload = await fetch(presign.body.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp' },
    body: fakeImageBlob
  });
  assert(upload.status === 200, 'direct cloud upload should return 200');

  const finalize = await request('/drawing/finalize-upload', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      duration,
      publicUrl: presign.body.publicUrl,
      objectKey: presign.body.objectKey,
      minBytes: fakeImageBlob.size,
      signatureName
    })
  });

  assert(finalize.response.status === 200, '/drawing/finalize-upload should return 200');
  assert(finalize.body?.verified === true, 'finalize-upload should confirm verified=true');

  const gallery = await request(`/drawing/gallery?duration=${duration}&limit=25`);
  assert(gallery.response.status === 200, '/drawing/gallery should return 200');
  assert(Array.isArray(gallery.body?.items), 'gallery response should include items[]');
  const foundInGallery = gallery.body.items.some((item) => item.objectKey === presign.body.objectKey || item.imageUrl === presign.body.publicUrl);
  assert(foundInGallery, 'new demo artwork should appear in gallery response');

  const mine = await request(`/drawing/my-artworks?limit=25`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  assert(mine.response.status === 200, '/drawing/my-artworks should return 200');
  assert(Array.isArray(mine.body?.items), 'my-artworks should include items[]');
  const foundInMine = mine.body.items.some((item) => item.objectKey === presign.body.objectKey);
  assert(foundInMine, 'new demo artwork should appear in my-artworks response');

  const finalizeNegative = await request('/drawing/finalize-upload', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      duration,
      publicUrl: `${presign.body.publicUrl}?invalid=1`,
      objectKey: `${presign.body.objectKey}-missing`,
      minBytes: fakeImageBlob.size,
      signatureName
    })
  });

  assert(finalizeNegative.response.status === 409, 'negative finalize-upload should return 409 for non-existing cloud object');
  assert(finalizeNegative.body?.verified === false, 'negative finalize-upload should return verified=false');

  logStep('Demo smoke passed');
}

run().catch((error) => {
  console.error(`[smoke-demo] FAILED: ${error.message}`);
  process.exitCode = 1;
});
