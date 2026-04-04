import rateLimit from 'express-rate-limit';

const standardConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'too many requests, please try again later' }
} as const;

export const authLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 40
});

export const claimLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 120
});

export const storageLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 90
});

export const finalizeLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 120
});