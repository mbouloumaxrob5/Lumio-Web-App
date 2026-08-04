#!/usr/bin/env ts-node
/* scripts/ivfflat-autotune.ts

  Automatically evaluates multiple `lists` values for an IVFFLAT pgvector index
  on the Image.embedding column, benchmarks KNN query latency for each, and
  prints a recommendation.

  Usage examples:
    # Quick run with defaults (tries common list values)
    npx ts-node scripts/ivfflat-autotune.ts

    # Try a specific set of list sizes, run 40 queries, limit top 10, and keep created indexes
    npx ts-node scripts/ivfflat-autotune.ts --tryLists=16,64,100,256 --runs=40 --limit=10 --keep

  Notes:
  - This script will create CREATE INDEX CONCURRENTLY statements; they may take time
    depending on dataset size. By default temporary indexes are dropped after measurement.
  - Run against a prepopulated DB (images with embeddings).
  - Requires lib/prisma.ts to export `prisma` client.
*/

import { prisma } from '../lib/prisma';
import { randomBytes } from 'crypto';

function parseArg(name: string, fallback?: string) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  return arg.split('=')[1];
}

function parseBoolArg(name: string, fallback = false) {
  const arg = process.argv.find((a) => a === `--${name}`);
  if (arg) return true;
  return fallback;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runKnnBenchmark(vecStr: string, limit: number, runs: number) {
  // Warmup and then run repeated queries measuring time in ms
  const durations: number[] = [];
  // Warmup 3
  for (let i = 0; i < 3; i++) {
    await prisma.$queryRawUnsafe(`SELECT id, embedding <-> '[${vecStr}]'::vector AS distance FROM "Image" WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ${limit}`);
    await sleep(100);
  }

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    await prisma.$queryRawUnsafe(`SELECT id, embedding <-> '[${vecStr}]'::vector AS distance FROM "Image" WHERE embedding IS NOT NULL ORDER BY distance ASC LIMIT ${limit}`);
    durations.push(Date.now() - t0);
    // short pause
    await sleep(30);
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((s, v) => s + v, 0);
  const avg = sum / durations.length;
  const p = (p: number) => durations[Math.max(0, Math.floor(durations.length * p))] || durations[durations.length - 1];
  return { runs, avg, p50: p(0.5), p90: p(0.9), p95: p(0.95), p99: p(0.99), min: durations[0], max: durations[durations.length - 1] };
}

async function indexExists(indexName: string) {
  const res: any = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = '${indexName}'`);
  return Array.isArray(res) && res.length > 0;
}

async function createIvfIndex(indexName: string, lists: number) {
  console.log(`Creating index ${indexName} WITH (lists = ${lists}) ...`);
  // Use vector_l2_ops (euclidean). If you use normalized embeddings prefer vector_cosine_ops.
  await prisma.$executeRawUnsafe(`CREATE INDEX CONCURRENTLY ${indexName} ON "Image" USING ivfflat (embedding vector_l2_ops) WITH (lists = ${lists})`);
  console.log('Index creation finished. ANALYZE "Image"');
  await prisma.$executeRawUnsafe(`ANALYZE "Image"`);
}

async function dropIndex(indexName: string) {
  console.log(`Dropping index ${indexName} ...`);
  try {
    await prisma.$executeRawUnsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
    console.log('Dropped.');
  } catch (e) {
    console.warn('Failed to drop index', e?.message || e);
  }
}

async function main() {
  const tryListsArg = parseArg('tryLists', '16,64,100,256');
  const runs = Number(parseArg('runs', '50'));
  const limit = Number(parseArg('limit', '10'));
  const keep = parseBoolArg('keep');

  const tryLists = tryListsArg!.split(',').map((s) => Number(s.trim())).filter(Boolean);
  console.log('Auto-tune IVFFLAT — lists candidates:', tryLists);
  console.log(`Benchmark: runs=${runs}, limit=${limit}, keepIndexes=${keep}`);

  // pick a sample embedding
  const sample = await prisma.image.findFirst({ where: { embedding: { not: null } } });
  if (!sample || !Array.isArray(sample.embedding) || sample.embedding.length === 0) {
    console.error('No image with embeddings found. Please seed embeddings first.');
    process.exit(1);
  }
  const vec = sample.embedding as number[];
  const vecStr = vec.join(',');

  const results: any[] = [];

  for (const lists of tryLists) {
    const indexName = `image_embedding_ivfflat_auto_${lists}_${randomBytes(4).toString('hex')}`;

    // create index
    try {
      await createIvfIndex(indexName, lists);
    } catch (e) {
      console.error(`Index create failed for lists=${lists}:`, e?.message || e);
      continue;
    }

    // small wait to ensure planner picked up
    await sleep(500);

    // run benchmark
    console.log(`Running benchmark for lists=${lists} ...`);
    const stats = await runKnnBenchmark(vecStr, limit, runs);
    console.log(`Results for lists=${lists}: avg=${stats.avg.toFixed(1)}ms p50=${stats.p50}ms p95=${stats.p95}ms p99=${stats.p99}ms`);
    results.push({ lists, indexName, stats });

    if (!keep) {
      await dropIndex(indexName);
    } else {
      console.log(`Keeping index ${indexName} (you can drop later)`);
    }
  }

  // choose best lists by p95 then avg
  results.sort((a, b) => a.stats.p95 - b.stats.p95 || a.stats.avg - b.stats.avg);
  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`lists=${r.lists} — p95=${r.stats.p95}ms p50=${r.stats.p50}ms avg=${r.stats.avg.toFixed(1)}ms`);
  }
  if (results.length > 0) {
    const best = results[0];
    console.log(`\nRecommendation: lists=${best.lists} (index ${best.indexName}) — p95=${best.stats.p95}ms`);
    console.log('To persist this index, run (adjust lists if needed):');
    console.log(`psql "<DATABASE_URL>" -c "CREATE INDEX CONCURRENTLY image_embedding_ivfflat ON \"Image\" USING ivfflat (embedding vector_l2_ops) WITH (lists = ${best.lists})"`);
  } else {
    console.log('No results (all index creations failed).');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
