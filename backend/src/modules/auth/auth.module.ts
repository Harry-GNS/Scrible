import { Router } from 'express';

import { getGoogleClientId, verifyGoogleCredential } from './auth.service.js';

export const authRouter = Router();

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

  try {
    const user = await verifyGoogleCredential(credential);
    res.status(200).json({
      user,
      provider: 'google'
    });
  } catch {
    res.status(401).json({
      message: 'invalid google credential'
    });
  }
});
