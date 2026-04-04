import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const prompts = [
  'Dibuja un objeto cotidiano como si fuera un personaje.',
  'Convierte una nube en una criatura amable.',
  'Diseña una escena nocturna con una sola fuente de luz.'
];

function toUtcDayKey(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return date.toISOString().slice(0, 10);
}

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { id: 'google-user-1' },
      update: { name: 'Luna Rivera', email: 'luna@example.com', picture: 'https://example.com/luna.png' },
      create: {
        id: 'google-user-1',
        name: 'Luna Rivera',
        email: 'luna@example.com',
        picture: 'https://example.com/luna.png',
        provider: 'google'
      }
    }),
    prisma.user.upsert({
      where: { id: 'google-user-2' },
      update: { name: 'Mateo Costa', email: 'mateo@example.com', picture: 'https://example.com/mateo.png' },
      create: {
        id: 'google-user-2',
        name: 'Mateo Costa',
        email: 'mateo@example.com',
        picture: 'https://example.com/mateo.png',
        provider: 'google'
      }
    })
  ]);

  const dailyPrompts = await Promise.all(
    prompts.map((prompt, index) =>
      prisma.dailyPrompt.upsert({
        where: { dateKey: toUtcDayKey(-index) },
        update: { prompt, source: 'seed' },
        create: {
          dateKey: toUtcDayKey(-index),
          prompt,
          source: 'seed'
        }
      })
    )
  );

  const artworks = await Promise.all([
    prisma.artwork.upsert({
      where: {
        userId_dailyPromptId_duration: {
          userId: users[0].id,
          dailyPromptId: dailyPrompts[0].id,
          duration: 5
        }
      },
      update: {
        status: 'PUBLISHED',
        objectKey: 'artworks/seed/sample-1.webp',
        publicUrl: 'https://example.com/artworks/sample-1.webp',
        signatureName: 'Luna'
      },
      create: {
        userId: users[0].id,
        dailyPromptId: dailyPrompts[0].id,
        duration: 5,
        status: 'PUBLISHED',
        objectKey: 'artworks/seed/sample-1.webp',
        publicUrl: 'https://example.com/artworks/sample-1.webp',
        signatureName: 'Luna'
      }
    }),
    prisma.artwork.upsert({
      where: {
        userId_dailyPromptId_duration: {
          userId: users[1].id,
          dailyPromptId: dailyPrompts[1].id,
          duration: 10
        }
      },
      update: {
        status: 'PUBLISHED',
        objectKey: 'artworks/seed/sample-2.webp',
        publicUrl: 'https://example.com/artworks/sample-2.webp',
        signatureName: 'Mateo'
      },
      create: {
        userId: users[1].id,
        dailyPromptId: dailyPrompts[1].id,
        duration: 10,
        status: 'PUBLISHED',
        objectKey: 'artworks/seed/sample-2.webp',
        publicUrl: 'https://example.com/artworks/sample-2.webp',
        signatureName: 'Mateo'
      }
    })
  ]);

  await prisma.comment.upsert({
    where: { id: 'seed-comment-1' },
    update: { body: 'Buen contraste y composición.' },
    create: {
      id: 'seed-comment-1',
      artworkId: artworks[0].id,
      userId: users[1].id,
      body: 'Buen contraste y composición.'
    }
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });