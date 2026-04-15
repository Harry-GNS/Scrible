import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authRouter } from './modules/auth/auth.module.js';
import { drawingRouter } from './modules/drawing/drawing.module.js';
import { healthRouter } from './modules/health/health.module.js';
import { storageRouter } from './modules/storage/storage.module.js';
import { makeRequestId, writeLog } from './shared/logger.js';

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
  app.use((req, res, next) => {
    const requestId = String(req.headers['x-request-id'] ?? '').trim() || makeRequestId();
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;

    const startedAt = Date.now();
    res.on('finish', () => {
      writeLog('info', 'request.completed', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        ip: req.ip
      });
    });

    next();
  });
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

  app.use((req, res) => {
    res.status(404).json({
      code: 'ROUTE_NOT_FOUND',
      message: 'route not found',
      requestId: String(res.locals.requestId ?? '')
    });
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = String(res.locals.requestId ?? '');

    if (error instanceof Error && error.message === 'CORS origin not allowed') {
      writeLog('warn', 'request.blocked.cors', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        origin: String(req.headers.origin ?? '')
      });

      res.status(403).json({
        code: 'CORS_ORIGIN_NOT_ALLOWED',
        message: 'origin not allowed by CORS policy',
        requestId
      });
      return;
    }

    writeLog('error', 'request.failed.unhandled', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      error: error instanceof Error ? error.message : 'unknown error'
    });

    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'unexpected server error',
      requestId
    });
  });

  return app;
}
