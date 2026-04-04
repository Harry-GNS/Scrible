import { Router } from 'express';

import { drawingService } from './drawing.service.js';

export const drawingRouter = Router();

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
  const userId = String(req.query.userId ?? '').trim();
  const duration = Number.parseInt(String(req.query.duration ?? ''), 10);

  if (!userId) {
    res.status(400).json({ message: 'userId is required' });
    return;
  }

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

drawingRouter.post('/claim', async (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);

  if (!userId) {
    res.status(400).json({ message: 'userId is required' });
    return;
  }

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
  const userId = String(req.body?.userId ?? '').trim();
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);
  const publicUrl = String(req.body?.publicUrl ?? '').trim();
  const objectKey = String(req.body?.objectKey ?? '').trim();
  const signatureName = String(req.body?.signatureName ?? '').trim();

  if (!userId) {
    res.status(400).json({ message: 'userId is required' });
    return;
  }

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
