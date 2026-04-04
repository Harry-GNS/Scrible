import { Router } from 'express';

import { prisma } from '../../shared/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    const [users, artworks, dailyPrompts, comments] = await Promise.all([
      prisma.user.count(),
      prisma.artwork.count(),
      prisma.dailyPrompt.count(),
      prisma.comment.count()
    ]);

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        users,
        artworks,
        dailyPrompts,
        comments
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: false
      },
      message: error instanceof Error ? error.message : 'database unavailable'
    });
  }
});
