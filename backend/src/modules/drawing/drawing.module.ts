import { Router } from 'express';

import { drawingService } from './drawing.service.js';

export const drawingRouter = Router();

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
