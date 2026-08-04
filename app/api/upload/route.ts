import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import axios from 'axios';
import { prisma } from '../../../lib/prisma';
import { generateBlurDataUrl, extractPalette } from '../../../lib/image-utils';
import { getEmbedding } from '../../../lib/embeddings';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { rateLimit } from '../../../lib/rate-limit';

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 15 * 1024 * 1024); // default 15MB
const ALLOWED_MIME = (process.env.UPLOAD_ALLOWED_MIME || 'image/jpeg,image/png,image/webp,image/avif').split(',');
const UPLOAD_RATE_MAX = Number(process.env.UPLOAD_RATE_MAX || 10); // per window
const UPLOAD_RATE_WINDOW_MS = Number(process.env.UPLOAD_RATE_WINDOW_MS || 60 * 60 * 1000); // 1h

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function POST(req: Request) {
  try {
    // basic rate limit per IP
    const ip = getClientIp(req);
    try {
      rateLimit(`upload:${ip}`, UPLOAD_RATE_MAX, UPLOAD_RATE_WINDOW_MS);
    } catch (err: any) {
      return NextResponse.json({ error: 'Too many upload requests, try later' }, { status: 429, headers: { 'Retry-After': String(err.retryAfter || 60) } });
    }

    const body = await req.json();
    const { fileName, mimeType, fileBase64, title, description, tags = [], categories = [] } = body || {};
    if (!fileName || !fileBase64) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds max allowed size' }, { status: 413 });
    }

    // detect mime via magic bytes
    const ft = await fileTypeFromBuffer(buffer);
    const detected = ft?.mime || mimeType || null;
    if (!detected || !ALLOWED_MIME.includes(detected)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(tmpPath, buffer);

    // Upload to Uploadthing if configured
    let url = `/assets/seed/${fileName}`;
    let publicId: string | null = null;

    const uploadEndpoint = process.env.UPLOADTHING_ENDPOINT;
    const uploadApiKey = process.env.UPLOADTHING_API_KEY;

    if (uploadEndpoint && uploadApiKey) {
      const form = new FormData();
      form.append('file', await fs.readFile(tmpPath), { filename: fileName, contentType: detected });
      try {
        const resp = await axios.post(uploadEndpoint, form, {
          headers: { ...form.getHeaders(), 'x-api-key': uploadApiKey },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });
        if (resp.data?.url) {
          url = resp.data.url;
          publicId = resp.data.publicId || null;
        }
      } catch (err) {
        console.warn('Uploadthing upload failed', err?.message || err);
      }
    }

    // Generate blurDataUrl + palette + embedding
    const blurDataUrl = await generateBlurDataUrl(tmpPath, 24);
    const palette = await extractPalette(tmpPath);
    const embedding = await getEmbedding({ text: title, imagePath: tmpPath });

    // Dimensions
    let width = 1200;
    let height = 800;
    try {
      const meta = await sharp(tmpPath).metadata();
      width = meta.width || width;
      height = meta.height || height;
    } catch (err) {
      // ignore
    }

    // Creator fallback: pick first user if no authenticated session (session handling can be added later)
    const creator = await prisma.user.findFirst();
    const creatorConnect = creator ? { connect: { id: creator.id } } : undefined;

    const slug = (title || fileName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const image = await prisma.image.create({
      data: {
        title: title || fileName,
        description: description || null,
        slug,
        url,
        publicId,
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
      }
    });

    // Tags: ensure tags exist
    for (const t of tags) {
      const tagSlug = String(t).toLowerCase().replace(/\s+/g, '-');
      const tag = await prisma.tag.upsert({ where: { slug: tagSlug }, create: { name: String(t), slug: tagSlug }, update: {} });
      await prisma.imageTag.create({ data: { imageId: image.id, tagId: tag.id } });
    }

    // Categories
    for (const c of categories) {
      const catSlug = String(c).toLowerCase().replace(/\s+/g, '-');
      const cat = await prisma.category.upsert({ where: { slug: catSlug }, create: { name: String(c), slug: catSlug }, update: {} });
      await prisma.imageCategory.create({ data: { imageId: image.id, categoryId: cat.id } });
    }

    // Cleanup tmp file
    try {
      await fs.unlink(tmpPath);
    } catch (err) {
      // ignore
    }

    return NextResponse.json({ ok: true, image });
  } catch (err) {
    console.error('Upload route error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
