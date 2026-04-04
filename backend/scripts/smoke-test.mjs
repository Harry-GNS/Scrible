/* eslint-disable no-console */

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const verbose = process.argv.includes('--verbose');

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

  const claim = await request('/drawing/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, duration })
  });
  assert(claim.response.status === 201, '/drawing/claim should return 201 for a new user/day/duration');

  const eligibility = await request(`/drawing/eligibility?userId=${encodeURIComponent(userId)}&duration=${duration}`);
  assert(eligibility.response.status === 200, '/drawing/eligibility should return 200');
  assert(eligibility.body?.allowed === false, 'eligibility should be false after claiming same day/duration');

  const myArtworks = await request(`/drawing/my-artworks?userId=${encodeURIComponent(userId)}&limit=10`);
  assert(myArtworks.response.status === 200, '/drawing/my-artworks should return 200');

  const gallery = await request(`/drawing/gallery?duration=${duration}&limit=25`);
  assert(gallery.response.status === 200, '/drawing/gallery should return 200');

  if (storageEnabled) {
    const fakeBytes = 12;
    const finalize = await request('/drawing/finalize-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
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
