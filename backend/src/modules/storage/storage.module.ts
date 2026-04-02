import { Router } from 'express';

import { drawingService } from '../drawing/drawing.service.js';
import { storageService } from './storage.service.js';

export const storageRouter = Router();

storageRouter.get('/config', (_req, res) => {
  res.status(200).json(storageService.getConfigStatus());
});

storageRouter.post('/presign-upload', async (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  const duration = Number.parseInt(String(req.body?.duration ?? ''), 10);
  const contentType = String(req.body?.contentType ?? '').trim().toLowerCase();
  const fileSizeBytes = Number.parseInt(String(req.body?.fileSizeBytes ?? ''), 10);

  if (!userId) {
    res.status(400).json({ message: 'userId is required' });
    return;
  }

  if (!Number.isFinite(duration) || !drawingService.isValidDuration(duration)) {
    res.status(400).json({ message: 'duration must be one of 1, 5, 10, 15' });
    return;
  }

  if (!storageService.isValidContentType(contentType)) {
    res.status(400).json({ message: 'contentType must be image/png, image/jpeg or image/webp' });
    return;
  }

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    res.status(400).json({ message: 'fileSizeBytes must be a positive number' });
    return;
  }

  if (fileSizeBytes > storageService.getMaxUploadBytes()) {
    res.status(413).json({
      message: 'file exceeds max upload size',
      maxUploadBytes: storageService.getMaxUploadBytes()
    });
    return;
  }

  if (!drawingService.canClaim(userId, duration)) {
    res.status(409).json({
      message: 'already claimed for this UTC day and duration',
      userId,
      duration,
      dayKeyUtc: drawingService.getDayKeyUtc(),
      allowed: false
    });
    return;
  }

  try {
    const signed = await storageService.createUploadUrl({
      userId,
      duration,
      contentType
    });

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

    res.status(201).json(signed);
  } catch {
    res.status(500).json({
      message: 'R2 upload signing failed. Check storage configuration.'
    });
  }
});
