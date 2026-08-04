import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { imageId, embedding, page = 1, limit = 12, weights = {} } = await req.json();

    const vectorWeight = Number(weights.vector ?? 0.6);
    const tagWeight = Number(weights.tags ?? 0.25);
    const colorWeight = Number(weights.color ?? 0.15);

    let baseEmbedding = embedding;
    if (!baseEmbedding && imageId) {
      const img = await prisma.image.findUnique({ where: { id: imageId } });
      if (!img || !img.embedding) {
        return NextResponse.json({ error: 'Image or embedding not found' }, { status: 404 });
      }
      baseEmbedding = img.embedding as number[];
    }

    if (!baseEmbedding || !Array.isArray(baseEmbedding)) {
      return NextResponse.json({ error: 'No embedding provided' }, { status: 400 });
    }

    const dim = baseEmbedding.length;
    const vecStr = baseEmbedding.join(',');

    const lim = Math.min(100, Math.max(5, Number(limit)));
    const off = Math.max(0, (Number(page) - 1) * lim);

    // raw KNN
    const raw = await prisma.$queryRawUnsafe(`
      SELECT id, title, url, "creatorId", embedding <-> '[${vecStr}]'::vector AS distance, embedding, dominantColor
      FROM "Image"
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${lim} OFFSET ${off}
    `);

    // caching using Redis if available
    let baseTags: string[] = [];
    let baseColor = '#cccccc';
    if (imageId) {
      const base = await prisma.image.findUnique({ where: { id: imageId }, include: { tags: { include: { tag: true } } } });
      if (base) {
        baseTags = (base.tags || []).map((it: any) => it.tag.slug);
        baseColor = base.dominantColor || baseColor;
      }
    }

    function hexToRgb(hex: string) {
      const h = hex.replace('#', '');
      const bigint = parseInt(h, 16);
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }

    function colorDistanceHex(a: string, b: string) {
      try {
        const A = hexToRgb(a || '#000000');
        const B = hexToRgb(b || '#000000');
        const d = Math.sqrt((A.r - B.r) ** 2 + (A.g - B.g) ** 2 + (A.b - B.b) ** 2);
        return d / Math.sqrt(255 * 255 * 3);
      } catch (e) {
        return 1;
      }
    }

    const distances = raw.map((r: any) => Number(r.distance));
    const maxD = Math.max(...distances, 1);
    const minD = Math.min(...distances, 0);

    const scored = [] as any[];
    for (const r of raw) {
      const candidateTags = await prisma.imageTag.findMany({ where: { imageId: r.id }, include: { tag: true } });
      const candidateTagSlugs = (candidateTags || []).map((ct: any) => ct.tag.slug);
      const overlap = candidateTagSlugs.filter((t: string) => baseTags.includes(t)).length;
      const tagScore = baseTags.length > 0 ? 1 - overlap / baseTags.length : 1;
      const colorScore = colorDistanceHex(baseColor || '#000000', r.dominantColor || '#000000');
      const normDist = (Number(r.distance) - minD) / (maxD - minD + 1e-9);

      const score = vectorWeight * normDist + tagWeight * tagScore + colorWeight * colorScore;
      scored.push({ ...r, score });
    }

    scored.sort((a, b) => a.score - b.score);
    const top = scored.slice(0, Math.min(lim, scored.length));

    return NextResponse.json({ ok: true, page: Number(page), limit: lim, results: top });
  } catch (err) {
    console.error('Visual Echo advanced error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
