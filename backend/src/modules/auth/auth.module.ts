import { Router } from 'express';

import { issueTokenPair, verifyAccessToken, verifyRefreshToken } from '../../shared/auth-token.js';
import { authLimiter } from '../../shared/rate-limit.js';
import {
  findUserProfileById,
  getGoogleClientId,
  normalizeAuthProfile,
  upsertGoogleUser,
  verifyGoogleCredential
} from './auth.service.js';

export const authRouter = Router();

authRouter.use(authLimiter);

function getBearerToken(headerValue: string | undefined): string {
  const raw = String(headerValue ?? '').trim();
  if (!raw.startsWith('Bearer ')) {
    return '';
  }
  return raw.slice('Bearer '.length).trim();
}

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
    const profile = normalizeAuthProfile({
      userId: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: 'google'
    });
    const tokens = issueTokenPair({
      sub: profile.userId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      provider: profile.provider
    });

    res.status(200).json({
      user: {
        userId: profile.userId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        provider: profile.provider
      },
      provider: 'google',
      tokens
    });
  } catch {
    res.status(503).json({
      message: 'database unavailable'
    });
  }
});

authRouter.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refreshToken ?? '').trim();

  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken is required' });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ message: 'invalid refresh token' });
    return;
  }

  try {
    const user = await findUserProfileById(payload.sub);
    if (!user) {
      res.status(404).json({ message: 'user not found' });
      return;
    }

    const tokens = issueTokenPair({
      sub: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: user.provider
    });

    res.status(200).json({
      user,
      tokens
    });
  } catch {
    res.status(503).json({
      message: 'database unavailable'
    });
  }
});

authRouter.get('/me', async (req, res) => {
  const accessToken = getBearerToken(req.headers.authorization);
  if (!accessToken) {
    res.status(401).json({ message: 'missing bearer token' });
    return;
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    res.status(401).json({ message: 'invalid access token' });
    return;
  }

  try {
    const user = await findUserProfileById(payload.sub);
    if (!user) {
      res.status(404).json({ message: 'user not found' });
      return;
    }

    res.status(200).json({ user });
  } catch {
    res.status(503).json({ message: 'database unavailable' });
  }
});
