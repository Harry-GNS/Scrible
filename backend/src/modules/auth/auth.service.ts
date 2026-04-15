import { OAuth2Client } from 'google-auth-library';

import { prisma } from '../../shared/prisma.js';

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';
const oauthClient = new OAuth2Client();

export function getGoogleClientId(): string {
  return googleClientId;
}

export type GoogleUser = {
  userId: string;
  email: string;
  name: string;
  picture: string;
};

export type AuthUserProfile = {
  userId: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
};

export function normalizeAuthProfile(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  provider?: string | null;
}): AuthUserProfile {
  return {
    userId: input.userId,
    email: input.email ?? '',
    name: input.name ?? 'Usuario',
    picture: input.picture ?? '',
    provider: input.provider ?? 'google'
  };
}

export async function upsertGoogleUser(user: GoogleUser) {
  return prisma.user.upsert({
    where: { id: user.userId },
    update: {
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: 'google'
    },
    create: {
      id: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: 'google'
    }
  });
}

export async function findUserProfileById(userId: string): Promise<AuthUserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      provider: true
    }
  });

  if (!user) {
    return null;
  }

  return normalizeAuthProfile({
    userId: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider
  });
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleUser> {
  if (!googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw new Error('invalid token payload');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name ?? 'Usuario',
    picture: payload.picture ?? ''
  };
}
