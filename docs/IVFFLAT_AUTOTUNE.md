## IVFFLAT autotune script

This script automates creating temporary IVFFLAT indexes with different `lists` values,
benchmarks KNN query latencies for each, and recommends a `lists` value to persist.

Usage:

  npx ts-node scripts/ivfflat-autotune.ts --tryLists=16,64,100,256 --runs=50 --limit=10

Options:
- --tryLists: comma-separated lists values to test (default: 16,64,100,256)
- --runs: number of KNN query repetitions per list (default 50)
- --limit: number of neighbors to request (default 10)
- --keep: if present, temporary indexes will NOT be dropped after benchmarking

Notes:
- The script requires that the DB has images with embeddings populated.
- It will create indexes CONCURRENTLY and then ANALYZE the table before running queries.
- By default temporary indexes are dropped after measurement.
