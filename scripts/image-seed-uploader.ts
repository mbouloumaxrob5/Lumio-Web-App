#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { generateBlurDataUrl, extractPalette } from '../lib/image-utils';
import { getEmbedding } from '../lib/embeddings';

async function uploadToUploadthing(filePath: string) {
  // This function assumes you have an Uploadthing endpoint that accepts file uploads and returns { url, publicId }
  // Configure UPLOADTHING_ENDPOINT and UPLOADTHING_API_KEY in env for the uploader to use.
  const endpoint = process.env.UPLOADTHING_ENDPOINT;
  const apiKey = process.env.UPLOADTHING_API_KEY;
  if (!endpoint || !apiKey) return null;

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const res = await axios.post(endpoint, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': apiKey
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return res.data;
  } catch (err) {
    console.warn('Uploadthing upload failed', err?.message || err);
    return null;
  }
}

async function main() {
  const seedDir = path.join(process.cwd(), 'public', 'assets', 'seed');
  if (!fs.existsSync(seedDir)) {
    console.error('Seed directory not found:', seedDir);
    process.exit(1);
  }

  const files = fs.readdirSync(seedDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`Found ${files.length} image(s) in ${seedDir}`);

  for (const file of files) {
    const filePath = path.join(seedDir, file);
    const title = path.parse(file).name.replace(/[-_]/g, ' ');
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    console.log('Processing', file);

    // Upload
    let url = `/assets/seed/${file}`;
    let publicId = null;
    const uploadRes = await uploadToUploadthing(filePath);
    if (uploadRes && uploadRes.url) {
      url = uploadRes.url;
      publicId = uploadRes.publicId || null;
      console.log('Uploaded to Uploadthing:', url);
    } else {
      console.log('Using local asset path for', file);
    }

    // Generate blurDataUrl
    const blurDataUrl = await generateBlurDataUrl(filePath, 24);

    // Extract palette
    const palette = await extractPalette(filePath);

    // Generate embedding via local provider or fallback
    const embedding = await getEmbedding({ text: title, imagePath: filePath });

    // Dimensions (best effort via sharp)
    let width = 1200;
    let height = 800;
    try {
      const sharp = await import('sharp');
      const meta = await sharp.default(filePath).metadata();
      width = meta.width || width;
      height = meta.height || height;
    } catch (err) {
      // ignore
    }

    // Create or update image in DB
    const existing = await prisma.image.findUnique({ where: { slug } });
    if (existing) {
      await prisma.image.update({ where: { id: existing.id }, data: {
        title,
        description: `${title} — uploaded via seed uploader`,
        url,
        publicId,
        width,
        height,
        aspectRatio: width / height,
        blurDataUrl,
        thumbnailUrl: null,
        dominantColor: (palette && palette[0]?.color) || '#cccccc',
        palette,
        embedding,
        isPublic: true
      }});
      console.log('Updated image', slug);
    } else {
      // pick a random user
      const users = await prisma.user.findMany({ take: 1 });
      const creatorId = users[0]?.id;
      await prisma.image.create({ data: {
        title,
        description: `${title} — uploaded via seed uploader`,
        slug,
        url,
        publicId,
        width,
        height,
        aspectRatio: width / height,
        blurDataUrl,
        thumbnailUrl: null,
        dominantColor: (palette && palette[0]?.color) || '#cccccc',
        palette,
        mood: 'CALM',
        embedding,
        isPublic: true,
        creator: creatorId ? { connect: { id: creatorId } } : undefined
      }});
      console.log('Created image', slug);
    }
  }

  console.log('Uploader finished.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
