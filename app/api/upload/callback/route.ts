import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '../../../lib/prisma';
import { generateBlurDataUrl, extractPalette } from '../../../lib/image-utils';
import { getEmbedding } from '../../../lib/embeddings';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { rateLimit } from '../../../lib/rate-limit';
import { getS3ObjectBuffer } from '../../../lib/s3';

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 15 * 1024 * 1024);
const ALLOWED_MIME = (process.env.UPLOAD_ALLOWED_MIME || 'image/jpeg,image/png,image/webp,image/avif').split(',');
const UPLOAD_RATE_MAX = Number(process.env.UPLOAD_RATE_MAX || 10);
const UPLOAD_RATE_WINDOW_MS = Number(process.env.UPLOAD_RATE_WINDOW_MS || 60 * 60 * 1000);

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function POST(req: Request) {
  try {
    // rate limit
    const ip = getClientIp(req);
    try {
      await rateLimit(`upload_finalize:${ip}`, UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW_MS);
    } catch (err: any) {
      return NextResponse.json({ error: 'Too many finalize requests, try later' }, { status: 429, headers: { 'Retry-After': String(err.retryAfter || 60) } });
    }

    const body = await req.json();
    const { url, publicId, objectKey, fileName, mimeType, title, description, tags = [], categories = [] } = body || {};
    if (!url && !objectKey) return NextResponse.json({ error: 'Missing url or objectKey' }, { status: 400 });

    // download remote file to tmp (S3 path handling)
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `${Date.now()}-${fileName || 'file'}`);
    let buf: Buffer;

    if (objectKey && process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      buf = await getS3ObjectBuffer(objectKey);
    } else {
      const resp = await axios.get(url as string, { responseType: 'arraybuffer', timeout: 120000 });
      buf = Buffer.from(resp.data);
    }

    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds max allowed size' }, { status: 413 });
    }

    const ft = await fileTypeFromBuffer(buf);
    const detected = ft?.mime || mimeType || null;
    if (!detected || !ALLOWED_MIME.includes(detected)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    await fs.writeFile(tmpPath, buf);

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

    const slug = (title || fileName || (url ? path.basename(url) : 'uploaded')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const image = await prisma.image.create({ data: {
      title: title || fileName || 'Uploaded image',
      description: description || null,
      slug,
      url: (process.env.S3_PUBLIC_URL && objectKey) ? `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}` : (url || null),
      publicId: publicId || (objectKey || null),
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
