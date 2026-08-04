# IVFFLAT Index & Benchmark

This document explains how to create an IVFFLAT index on the Image.embedding column (pgvector) and how to benchmark KNN query latency.

1) Create the index (run once):

  psql <your-db-connection> -f prisma/sql/create_ivfflat_index.sql

Adjust the lists parameter in the SQL file based on your dataset size and memory.

2) Benchmark KNN queries using the included script:

  npx ts-node scripts/benchmark-ivfflat.ts --runs=50 --limit=10

The script samples an existing image embedding from the DB and runs repeated KNN queries using the same embedding, reporting avg/p50/p90/p95/p99 latencies.

Notes:
- Make sure to ANALYZE the table after creating the index.
- For production, test with representative queries and dataset sizes.
- Consider tuning the index `lists` parameter, and consider using a dedicated vector DB (Qdrant/Milvus) for very large datasets.
