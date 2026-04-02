import cors from 'cors';
import express from 'express';

import { authRouter } from './modules/auth/auth.module.js';
import { drawingRouter } from './modules/drawing/drawing.module.js';
import { healthRouter } from './modules/health/health.module.js';
import { storageRouter } from './modules/storage/storage.module.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'Scrible backend is running',
      health: '/health',
      auth: '/auth',
      drawing: '/drawing',
      storage: '/storage'
    });
  });
  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/drawing', drawingRouter);
  app.use('/storage', storageRouter);

  return app;
}
