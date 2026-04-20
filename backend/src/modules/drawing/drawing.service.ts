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

  async listPublishedGallery(input: {
    dayKey: string;
    duration: number;
    limit: number;
  }) {
    const items = await prisma.artwork.findMany({
      where: {
        duration: input.duration,
        status: 'PUBLISHED',
        publicUrl: {
          not: null
        },
        dailyPrompt: {
          dateKey: input.dayKey
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: input.limit,
      select: {
        id: true,
        duration: true,
        publicUrl: true,
        signatureName: true,
        createdAt: true,
        dailyPrompt: {
          select: {
            dateKey: true,
            prompt: true
          }
        }
      }
    });

    return items.map((item) => ({
      id: item.id,
      duration: item.duration,
      imageUrl: item.publicUrl ?? '',
      signatureName: item.signatureName,
      createdAt: item.createdAt,
      prompt: item.dailyPrompt.prompt,
      dayKeyUtc: item.dailyPrompt.dateKey,
      storage: 'cloud' as const
    }));
  }

  async listUserArtworks(input: {
    userId: string;
    limit: number;
  }) {
    const dayKey = this.getDayKeyUtc();
    const items = await prisma.artwork.findMany({
      where: {
        userId: input.userId,
        status: 'PUBLISHED',
        publicUrl: {
          not: null
        },
        dailyPrompt: {
          dateKey: dayKey
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: input.limit,
      select: {
        id: true,
        duration: true,
        publicUrl: true,
        objectKey: true,
        signatureName: true,
        createdAt: true,
        dailyPrompt: {
          select: {
            dateKey: true,
            prompt: true
          }
        }
      }
    });

    return items.map((item) => ({
      id: item.id,
      duration: item.duration,
      imageUrl: item.publicUrl,
      objectKey: item.objectKey,
      signatureName: item.signatureName,
      createdAt: item.createdAt,
      prompt: item.dailyPrompt.prompt,
      dayKeyUtc: item.dailyPrompt.dateKey,
      storage: 'cloud' as const
    }));
  }

  async toggleLike(artworkId: string, userId: string): Promise<{ liked: boolean; message?: string }> {
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      select: { id: true }
    });

    if (!artwork) {
      return { liked: false, message: 'Artwork not found' };
    }

    await this.ensureUser(userId);

    try {
      await prisma.like.create({
        data: {
          artworkId,
          userId
        }
      });

      return { liked: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        try {
          await prisma.like.delete({
            where: {
              artworkId_userId: {
                artworkId,
                userId
              }
            }
          });

          return { liked: false };
        } catch {
          return { liked: false, message: 'Failed to unlike' };
        }
      }

      throw error;
    }
  }

  async getLikeCount(artworkId: string): Promise<number> {
    return prisma.like.count({
      where: { artworkId }
    });
  }

  async userLikedArtwork(artworkId: string, userId: string): Promise<boolean> {
    const like = await prisma.like.findUnique({
      where: {
        artworkId_userId: {
          artworkId,
          userId
        }
      },
      select: { id: true }
    });

    return like !== null;
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
