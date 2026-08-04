#!/usr/bin/env ts-node
/* scripts/benchmark-ivfflat.ts

  Benchmarks KNN query latency for pgvector IVFFLAT index on Image.embedding.
  Usage:
    npx ts-node scripts/benchmark-ivfflat.ts --runs=50 --limit=10

  Requirements:
    - lib/prisma.ts exists and exports `prisma` (this repo has it)
    - A number of images with embeddings in the DB
*/

import { prisma } from '../lib/prisma';
import ms from 'ms';

async function sleep(msd: number) { return new Promise((r) => setTimeout(r, msd)); }

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string, fallback: string) => {
    const match = argv.join(' ').match(new RegExp(`--${name}=([^\s]+)`));
    return match ? match[1] : fallback;
  };

  const runs = Number(arg('runs', '50'));
  const limit = Number(arg('limit', '10'));

  console.log(`Benchmarking IVFFLAT KNN — runs=${runs} limit=${limit}`);

  const sample = await prisma.image.findFirst({ where: { embedding: { not: null } } });
  if (!sample || !Array.isArray(sample.embedding)) {
    console.error('No image with embeddings found. Run the seed uploader or create embeddings first.');
    process.exit(1);
  }

  const vec = (sample.embedding as number[]);
  const vecStr = vec.join(',');

  // Warmup
  console.log('Warming up queries (3)...');
  for (let i = 0; i < 3; i++) {
    await prisma.$queryRawUnsafe(`SELECT id, embedding <-> '[${vecStr}]'::vector AS distance FROM "Image" WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ${limit}`);
    await sleep(100);
  }

  const durations: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    const res = await prisma.$queryRawUnsafe(`SELECT id, embedding <-> '[${vecStr}]'::vector AS distance FROM "Image" WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ${limit}`);
    const dt = Date.now() - t0;
    durations.push(dt);
    if ((i + 1) % 10 === 0) console.log(`run ${i + 1}/${runs} — ${dt}ms`);
    // small pause to avoid hammering
    await sleep(50);
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((s, v) => s + v, 0);
  const avg = sum / durations.length;
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p90 = durations[Math.floor(durations.length * 0.9)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  console.log('--- Results ---');
  console.log(`runs: ${runs}`);
  console.log(`avg: ${avg.toFixed(1)} ms`);
  console.log(`p50: ${p50} ms`);
  console.log(`p90: ${p90} ms`);
  console.log(`p95: ${p95} ms`);
  console.log(`p99: ${p99} ms`);
  console.log(`min: ${durations[0]} ms, max: ${durations[durations.length - 1]} ms`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
