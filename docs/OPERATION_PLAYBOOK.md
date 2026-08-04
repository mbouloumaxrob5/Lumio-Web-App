# Lumio — Operations Playbook

This playbook summarizes environment variables, commands, and monitoring/alert recommendations for running Lumio in production and for local testing.

Environment variables (minimum)

- DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB
- NEXTAUTH_SECRET=long-random-string
- NEXTAUTH_URL=https://your-app.example.com
- REDIS_URL=redis://:password@host:6379
- EMBEDDINGS_URL=http://embeddings-proxy:8080
- EMBEDDING_DIM=1536

S3 (if using presigned S3 flow)
- AWS_ACCESS_KEY_ID=AKIA...
- AWS_SECRET_ACCESS_KEY=...
- S3_BUCKET=your-bucket-name
- S3_REGION=us-east-1
- S3_PUBLIC_URL=https://your-bucket.s3.us-east-1.amazonaws.com

Upload configuration
- UPLOAD_MAX_BYTES=15728640 (15MB)
- UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp,image/avif
- UPLOAD_RATE_MAX=10
- UPLOAD_RATE_WINDOW_MS=3600000

Optional (OpenAI)
- OPENAI_API_KEY=sk-...
- OPENAI_MODEL=text-embedding-3-small

Key commands
- Install & dev
  npm install
  npx prisma generate
  npx prisma migrate dev --name init
  npm run seed
  npm run dev

- Run embeddings proxy
  cd services/embeddings-proxy
  npm install
  OPENAI_API_KEY=sk-... EMBEDDING_DIM=1536 npm start

- Start Redis (local)
  docker run -p 6379:6379 -d redis:7

- Run E2E tests (Playwright)
  npm run dev (in one terminal)
  npx playwright test

Database & Indexing
- pgvector index recommended for production:
  -- Example SQL (adapt to your dimension and operator):
  CREATE INDEX image_embedding_ivfflat ON "Image" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

- Run this in psql or via migration after ensuring the extension and enough rows.

Monitoring & Alerts (suggestions)
- Metrics to collect:
  - Upload success/failure rate
  - Embedding latency (ms)
  - Visual Echo query latency / KNN time
  - SSE/DDOS: number of open SSE connections
  - Rate-limit hits
  - Error rates (5xx) per endpoint

- Alerts (suggested thresholds):
  - Upload failure rate > 5% over 5m
  - Embedding latency > 2s (p95)
  - Redis down or large increase in rate-limit hits
  - KNN query latency > 1s

- Logging:
  - Log upload events (user, size, result)
  - Log finalize errors with stack and objectKey/url
  - Log notification delivery failures

Security & Ops
- Enforce HTTPS and HSTS
- Rotate NEXTAUTH_SECRET and AWS keys periodically
- Use least-privilege IAM for S3 (write-only for presign flow)
- Use signed cookies or CloudFront signed URLs if exposing a CDN-fronted S3
- Add virus scanning pipeline for user uploads (optional)

Backups & Data Retention
- Regular DB backups (daily) and WAL archiving
- S3 lifecycle rules for older assets or tiering to Glacier
- Purge soft-deleted images after retention period

Scaling considerations
- Run multiple Next.js instances behind a load balancer
- Redis for SSE pub/sub and rate-limiting
- Use managed Postgres with pgvector support; ensure enough memory for ivfflat indexes
- Offload embeddings to a dedicated service (OpenAI or internal GPU infra)

Operational runbook: typical failure scenarios
- Uploads failing with 403 on PUT to S3
  - Check presigned URL expiry and system clock skew
  - Verify S3 bucket policy and CORS
- SSE notifications not received
  - Check Redis connectivity and pub/sub channels
  - Verify client connected to /api/notifications/stream with correct userId
- Visual Echo returning empty or poor results
  - Check embeddings present in DB and EMBEDDING_DIM matches
  - Verify embeddings provider is healthy (proxy logs)

Contact & escalation
- Dev on-call: dev@example.com
- infra / cloud: infra@example.com

