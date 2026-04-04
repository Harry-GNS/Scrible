import cors from 'cors';
import express from 'express';

import { authRouter } from './modules/auth/auth.module.js';
import { drawingRouter } from './modules/drawing/drawing.module.js';
import { healthRouter } from './modules/health/health.module.js';
import { storageRouter } from './modules/storage/storage.module.js';

function parseAllowedOrigins(): string[] {
  const raw = String(process.env.ALLOWED_ORIGINS ?? '').trim();
  if (!raw) {
    return ['http://localhost:5500', 'http://127.0.0.1:5500'];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(parseAllowedOrigins());

  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('CORS origin not allowed'));
      }
    })
  );
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'Scrible backend is running',
      health: '/health',
      database: '/health',
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
