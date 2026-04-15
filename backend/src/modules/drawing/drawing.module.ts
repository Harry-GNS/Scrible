import { Router } from 'express';

import { drawingService } from './drawing.service.js';
import { storageService } from '../storage/storage.service.js';
import { claimLimiter, finalizeLimiter } from '../../shared/rate-limit.js';
import { resolveIdentity } from '../../shared/request-auth.js';

export const drawingRouter = Router();

drawingRouter.use('/claim', claimLimiter);
drawingRouter.use('/finalize-upload', finalizeLimiter);

drawingRouter.get('/gallery', async (req, res) => {
  const duration = Number.parseInt(String(req.query.duration ?? ''), 10);
  const dateKeyInput = String(req.query.dateKey ?? '').trim();
  const limitInput = Number.parseInt(String(req.query.limit ?? ''), 10);

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({
      message: 'duration must be one of 1, 5, 10, 15'
    });
    return;
  }

  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateKeyInput)
    ? dateKeyInput
    : drawingService.getDayKeyUtc();
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(limitInput, 1), 200) : 200;

  try {
    const items = await drawingService.listPublishedGallery({
      dayKey: dateKey,
      duration,
      limit
    });

    res.status(200).json({
      dayKeyUtc: dateKey,
      duration,
      count: items.length,
      items
    });
  } catch {
    res.status(500).json({
      message: 'database unavailable'
    });
  }
});

drawingRouter.get('/eligibility', async (req, res) => {
  const identity = resolveIdentity(req, String(req.query.userId ?? ''), { requireAuth: true });
  const duration = Number.parseInt(String(req.query.duration ?? ''), 10);

  if (!identity.ok || !identity.userId) {
    res.status(identity.status ?? 400).json({
      code: identity.code ?? 'INVALID_USER_IDENTITY',
      message: identity.message ?? 'invalid user identity'
    });
    return;
  }

  const userId = identity.userId;

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({
      message: 'duration must be one of 1, 5, 10, 15'
    });
    return;
  }

  try {
    const allowed = await drawingService.canClaim(userId, duration);
    res.status(200).json({
      userId,
      duration,
      dayKeyUtc: drawingService.getDayKeyUtc(),
      allowed
    });
  } catch {
    res.status(500).json({
      message: 'database unavailable'
    });
  }
});

drawingRouter.get('/my-artworks', async (req, res) => {
  const identity = resolveIdentity(req, String(req.query.userId ?? ''), { requireAuth: true });
  const limitInput = Number.parseInt(String(req.query.limit ?? ''), 10);

  if (!identity.ok || !identity.userId) {
    res.status(identity.status ?? 400).json({
      code: identity.code ?? 'INVALID_USER_IDENTITY',
      message: identity.message ?? 'invalid user identity'
    });
    return;
  }

  const userId = identity.userId;

  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(limitInput, 1), 200) : 100;

  try {
    const items = await drawingService.listUserArtworks({
      userId,
      limit
    });

    res.status(200).json({
      userId,
      count: items.length,
      items
    });
  } catch {
    res.status(500).json({
      message: 'database unavailable'
    });
  }
});

drawingRouter.post('/claim', async (req, res) => {
  const identity = resolveIdentity(req, String(req.body?.userId ?? ''), { requireAuth: true });
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);

  if (!identity.ok || !identity.userId) {
    res.status(identity.status ?? 400).json({
      code: identity.code ?? 'INVALID_USER_IDENTITY',
      message: identity.message ?? 'invalid user identity'
    });
    return;
  }

  const userId = identity.userId;

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({
      message: 'duration must be one of 1, 5, 10, 15'
    });
    return;
  }

  try {
    const claimed = await drawingService.claim(userId, duration);

    if (!claimed) {
      res.status(409).json({
        message: 'already claimed for this UTC day and duration',
        userId,
        duration,
        dayKeyUtc: drawingService.getDayKeyUtc(),
        allowed: false
      });
      return;
    }

    res.status(201).json({
      userId,
      duration,
      dayKeyUtc: drawingService.getDayKeyUtc(),
      allowed: true
    });
  } catch {
    res.status(500).json({
      message: 'database unavailable'
    });
  }
});

drawingRouter.post('/publish', async (req, res) => {
  const identity = resolveIdentity(req, String(req.body?.userId ?? ''), { requireAuth: true });
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);
  const publicUrl = String(req.body?.publicUrl ?? '').trim();
  const objectKey = String(req.body?.objectKey ?? '').trim();
  const signatureName = String(req.body?.signatureName ?? '').trim();

  if (!identity.ok || !identity.userId) {
    res.status(identity.status ?? 400).json({
      code: identity.code ?? 'INVALID_USER_IDENTITY',
      message: identity.message ?? 'invalid user identity'
    });
    return;
  }

  const userId = identity.userId;

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({
      message: 'duration must be one of 1, 5, 10, 15'
    });
    return;
  }

  if (!publicUrl) {
    res.status(400).json({ message: 'publicUrl is required' });
    return;
  }

  try {
    const published = await drawingService.publishArtwork({
      userId,
      duration,
      objectKey: objectKey || undefined,
      publicUrl,
      signatureName: signatureName || undefined
    });

    if (!published) {
      res.status(404).json({
        message: 'no claim found for this UTC day and duration',
        userId,
        duration,
        dayKeyUtc: drawingService.getDayKeyUtc()
      });
      return;
    }

    res.status(200).json({
      userId,
      duration,
      dayKeyUtc: drawingService.getDayKeyUtc(),
      status: 'PUBLISHED'
    });
  } catch {
    res.status(500).json({
      message: 'database unavailable'
    });
  }
});

drawingRouter.post('/finalize-upload', async (req, res) => {
  const identity = resolveIdentity(req, String(req.body?.userId ?? ''), { requireAuth: true });
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);
  const publicUrl = String(req.body?.publicUrl ?? '').trim();
  const objectKey = String(req.body?.objectKey ?? '').trim();
  const signatureName = String(req.body?.signatureName ?? '').trim();
  const minBytesInput = Number.parseInt(String(req.body?.minBytes ?? ''), 10);

  if (!identity.ok || !identity.userId) {
    res.status(identity.status ?? 400).json({
      code: identity.code ?? 'INVALID_USER_IDENTITY',
      message: identity.message ?? 'invalid user identity'
    });
    return;
  }

  const userId = identity.userId;

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({
      message: 'duration must be one of 1, 5, 10, 15'
    });
    return;
  }

  if (!publicUrl || !objectKey) {
    res.status(400).json({ message: 'publicUrl and objectKey are required' });
    return;
  }

  try {
    const verification = await storageService.verifyObjectExists({
      objectKey,
      minBytes: Number.isFinite(minBytesInput) && minBytesInput > 0 ? minBytesInput : undefined
    });

    if (!verification.exists) {
      res.status(409).json({
        message: 'cloud object not verified',
        objectKey,
        verified: false
      });
      return;
    }

    const published = await drawingService.publishArtwork({
      userId,
      duration,
      objectKey,
      publicUrl,
      signatureName: signatureName || undefined
    });

    if (!published) {
      res.status(404).json({
        message: 'no claim found for this UTC day and duration',
        userId,
        duration,
        dayKeyUtc: drawingService.getDayKeyUtc()
      });
      return;
    }

    res.status(200).json({
      userId,
      duration,
      dayKeyUtc: drawingService.getDayKeyUtc(),
      status: 'PUBLISHED',
      verified: true,
      objectKey,
      sizeBytes: verification.sizeBytes
    });
  } catch {
    res.status(500).json({
      message: 'finalize upload failed'
    });
  }
});
