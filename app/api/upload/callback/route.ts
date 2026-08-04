import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '../../../lib/prisma';
import { generateBlurDataUrl, extractPalette } from '../../../lib/image-utils';
import { getEmbedding } from '../../../lib/embeddings';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, publicId, fileName, mimeType, title, description, tags = [], categories = [] } = body || {};
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    // download remote file to tmp
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `${Date.now()}-${fileName || 'file'}`);
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
    await fs.writeFile(tmpPath, Buffer.from(resp.data));

    const blurDataUrl = await generateBlurDataUrl(tmpPath, 24);
    const palette = await extractPalette(tmpPath);
    const embedding = await getEmbedding({ text: title, imagePath: tmpPath });

    let width = 1200;
    let height = 800;
    try {
      const meta = await sharp(tmpPath).metadata();
      width = meta.width || width; height = meta.height || height;
    } catch (err) {}

    const creator = await prisma.user.findFirst();
    const creatorConnect = creator ? { connect: { id: creator.id } } : undefined;

    const slug = (title || fileName || path.basename(url)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const image = await prisma.image.create({ data: {
      title: title || fileName || 'Uploaded image',
      description: description || null,
      slug,
      url,
      publicId: publicId || null,
      width,
      height,
      aspectRatio: width / Math.max(1, height),
      blurDataUrl,
      thumbnailUrl: null,
      dominantColor: (palette && (palette as any)[0]?.color) || '#cccccc',
      palette,
      mood: 'NEUTRAL',
      embedding,
      isPublic: true,
      creator: creatorConnect
    }});

    for (const t of tags) {
      const tagSlug = String(t).toLowerCase().replace(/\s+/g, '-');
      const tag = await prisma.tag.upsert({ where: { slug: tagSlug }, create: { name: String(t), slug: tagSlug }, update: {} });
      await prisma.imageTag.create({ data: { imageId: image.id, tagId: tag.id } });
    }

    for (const c of categories) {
      const catSlug = String(c).toLowerCase().replace(/\s+/g, '-');
      const cat = await prisma.category.upsert({ where: { slug: catSlug }, create: { name: String(c), slug: catSlug }, update: {} });
      await prisma.imageCategory.create({ data: { imageId: image.id, categoryId: cat.id } });
    }

    try { await fs.unlink(tmpPath); } catch (e) {}

    return NextResponse.json({ ok: true, image });
  } catch (err) {
    console.error('Upload finalize error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
