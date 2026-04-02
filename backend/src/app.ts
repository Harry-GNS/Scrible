import cors from 'cors';
import express from 'express';

import { healthRouter } from './modules/health/health.module.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'Scrible backend is running',
      health: '/health'
    });
  });
  app.use('/health', healthRouter);

  return app;
}
