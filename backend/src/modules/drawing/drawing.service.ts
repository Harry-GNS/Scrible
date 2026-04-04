import { Prisma } from '@prisma/client';

import { prisma } from '../../shared/prisma.js';
import { getUtcDayKey } from '../../shared/utc.js';

const ALLOWED_DURATIONS = new Set([1, 5, 10, 15]);
const DAILY_PROMPTS = [
  'Dibuja un objeto cotidiano como si fuera un personaje.',
  'Convierte una nube en una criatura amable.',
  'Diseña una escena nocturna con una sola fuente de luz.',
  'Crea un paisaje urbano visto desde un balcón imaginario.',
  'Representa un recuerdo usando solo formas simples.'
];

function promptForDayKey(dayKey: string): string {
  const numericKey = dayKey.replace(/-/g, '');
  let total = 0;

  for (const char of numericKey) {
    total += Number.parseInt(char, 10);
  }

  return DAILY_PROMPTS[total % DAILY_PROMPTS.length];
}

class DrawingService {
  getDayKeyUtc(): string {
    return getUtcDayKey();
  }

  isValidDuration(duration: number): boolean {
    return ALLOWED_DURATIONS.has(duration);
  }

  async getCurrentDailyPrompt() {
    return this.ensureDailyPrompt(this.getDayKeyUtc());
  }

  async canClaim(userId: string, duration: number): Promise<boolean> {
    const prompt = await this.ensureDailyPrompt(this.getDayKeyUtc());
    const artwork = await prisma.artwork.findUnique({
      where: {
        userId_dailyPromptId_duration: {
          userId,
          dailyPromptId: prompt.id,
          duration
        }
      },
      select: { id: true }
    });

    return artwork === null;
  }

  async claim(userId: string, duration: number): Promise<boolean> {
    const prompt = await this.ensureDailyPrompt(this.getDayKeyUtc());
    await this.ensureUser(userId);

    try {
      await prisma.artwork.create({
        data: {
          userId,
          dailyPromptId: prompt.id,
          duration,
          status: 'CLAIMED'
        }
      });

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }

      throw error;
    }
  }

  async getClaim(userId: string, duration: number) {
    const prompt = await this.ensureDailyPrompt(this.getDayKeyUtc());

    return prisma.artwork.findUnique({
      where: {
        userId_dailyPromptId_duration: {
          userId,
          dailyPromptId: prompt.id,
          duration
        }
      }
    });
  }

  async attachUploadDetails(input: {
    userId: string;
    duration: number;
    objectKey: string;
    publicUrl: string;
  }) {
    const prompt = await this.ensureDailyPrompt(this.getDayKeyUtc());
    const artwork = await prisma.artwork.findUnique({
      where: {
        userId_dailyPromptId_duration: {
          userId: input.userId,
          dailyPromptId: prompt.id,
          duration: input.duration
        }
      }
    });

    if (!artwork) {
      return false;
    }

    await prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        objectKey: input.objectKey,
        publicUrl: input.publicUrl,
        status: 'UPLOADING'
      }
    });

    return true;
  }

  async publishArtwork(input: {
    userId: string;
    duration: number;
    objectKey?: string;
    publicUrl: string;
    signatureName?: string;
  }): Promise<boolean> {
    const prompt = await this.ensureDailyPrompt(this.getDayKeyUtc());
    const artwork = await prisma.artwork.findUnique({
      where: {
        userId_dailyPromptId_duration: {
          userId: input.userId,
          dailyPromptId: prompt.id,
          duration: input.duration
        }
      }
    });

    if (!artwork) {
      return false;
    }

    await prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        objectKey: input.objectKey ?? artwork.objectKey,
        publicUrl: input.publicUrl,
        signatureName: input.signatureName ? input.signatureName.trim().slice(0, 24) : null,
        status: 'PUBLISHED'
      }
    });

    return true;
  }

  private async ensureUser(userId: string) {
    return prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: userId,
        provider: 'local'
      }
    });
  }

  private async ensureDailyPrompt(dayKey: string) {
    return prisma.dailyPrompt.upsert({
      where: { dateKey: dayKey },
      update: {},
      create: {
        dateKey: dayKey,
        prompt: promptForDayKey(dayKey),
        source: 'generated'
      }
    });
  }
}

export const drawingService = new DrawingService();
