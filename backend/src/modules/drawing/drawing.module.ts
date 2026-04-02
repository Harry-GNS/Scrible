import { Router } from 'express';

import { drawingService } from './drawing.service.js';

export const drawingRouter = Router();

drawingRouter.get('/eligibility', (req, res) => {
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

  const allowed = drawingService.canClaim(userId, duration);
  res.status(200).json({
    userId,
    duration,
    dayKeyUtc: drawingService.getDayKeyUtc(),
    allowed
  });
});

drawingRouter.post('/claim', (req, res) => {
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

  const claimed = drawingService.claim(userId, duration);

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
});
