import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function createExtensionIfMissing() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Ensured pgvector extension exists (if permitted).');
  } catch (err) {
    console.warn('Could not create pgvector extension automatically. Ensure it exists in your DB.');
  }
}

function randomEmbedding(dim = 1536) {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

async function main() {
  console.log('Seeding database...');
  await createExtensionIfMissing();

  // Categories
  const categories = [
    'Art',
    'Photographie',
    'Design',
    'Nature',
    'Architecture',
    'Mode',
    'Abstract',
    'Lifestyle'
  ];

  const createdCategories = [];
  for (const name of categories) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const cat = await prisma.category.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    createdCategories.push(cat);
  }

  // Tags
  const sampleTags = ['minimal', 'portrait', 'landscape', 'color', 'motion', 'film', 'analog', 'architecture', 'interior', 'surreal'];
  const createdTags = [];
  for (const t of sampleTags) {
    const slug = t.toLowerCase().replace(/\s+/g, '-');
    const tag = await prisma.tag.upsert({ where: { slug }, create: { name: t, slug }, update: {} });
    createdTags.push(tag);
  }

  // Users
  const users = [];
  for (let i = 1; i <= 6; i++) {
    const email = `user${i}@example.com`;
    const username = `user${i}`;
    const name = `User ${i}`;
    const passwordHash = await argon2.hash('Password123!', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, username, name, passwordHash },
      update: { name },
    });
    users.push(user);
  }

  // Images (seed placeholders referencing public/assets �� replace with actual uploads via Uploadthing script)
  const sampleImages = [
    { title: 'Golden Hour Forest', file: '/public/assets/seed/forest-1.jpg', tags: ['nature', 'color'] },
    { title: 'Modern Architecture', file: '/public/assets/seed/arch-1.jpg', tags: ['architecture', 'design'] },
    { title: 'Portrait Study', file: '/public/assets/seed/portrait-1.jpg', tags: ['portrait', 'film'] },
    { title: 'Abstract Motion', file: '/public/assets/seed/abstract-1.jpg', tags: ['abstract', 'motion'] },
    { title: 'Calm Interior', file: '/public/assets/seed/interior-1.jpg', tags: ['interior', 'design'] }
  ];

  for (let i = 0; i < sampleImages.length; i++) {
    const img = sampleImages[i];
    const slug = img.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const creator = users[i % users.length];
    const image = await prisma.image.create({
      data: {
        title: img.title,
        description: `${img.title} — image seed entry. Replace with real upload via Uploadthing script.`,
        slug,
        url: img.file,
        publicId: null,
        width: 1200,
        height: 800,
        aspectRatio: 1200 / 800,
        blurDataUrl: null,
        thumbnailUrl: null,
        dominantColor: '#cccccc',
        palette: [{ color: '#cccccc', weight: 1 }],
        mood: 'CALM',
        embedding: randomEmbedding(),
        isPublic: true,
        creator: { connect: { id: creator.id } }
      }
    });

    // link tags
    for (const tagName of img.tags) {
      const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-');
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (tag) {
        await prisma.imageTag.create({ data: { imageId: image.id, tagId: tag.id } });
      }
    }

    // link a category (first category)
    const cat = createdCategories[i % createdCategories.length];
    await prisma.imageCategory.create({ data: { imageId: image.id, categoryId: cat.id } });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
