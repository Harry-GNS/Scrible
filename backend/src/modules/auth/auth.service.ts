import { OAuth2Client } from 'google-auth-library';

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
