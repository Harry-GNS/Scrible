import { Router } from 'express';

import { getGoogleClientId, upsertGoogleUser, verifyGoogleCredential } from './auth.service.js';
import { authLimiter } from '../../shared/rate-limit.js';

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.get('/config', (_req, res) => {
  const googleClientId = getGoogleClientId();
  res.status(200).json({
    googleClientId,
    googleEnabled: Boolean(googleClientId)
  });
});

authRouter.post('/google', async (req, res) => {
  const credential = String(req.body?.credential ?? '').trim();

  if (!credential) {
    res.status(400).json({ message: 'credential is required' });
    return;
  }

  let user: Awaited<ReturnType<typeof verifyGoogleCredential>>;

  try {
    user = await verifyGoogleCredential(credential);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GOOGLE_CLIENT_ID')) {
      res.status(503).json({
        message: error.message
      });
      return;
    }
    res.status(401).json({
      message: 'invalid google credential'
    });
    return;
  }

  try {
    await upsertGoogleUser(user);
    res.status(200).json({
      user,
      provider: 'google'
    });
  } catch {
    res.status(503).json({
      message: 'database unavailable'
    });
  }
});
