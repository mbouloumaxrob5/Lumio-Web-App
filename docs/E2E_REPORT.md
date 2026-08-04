# E2E Test Report — Presign → Upload → Finalize → Visual Echo → Like → Notification

This document logs the steps executed during a manual end-to-end test of the upload + visual echo + like + notification flow. Use it as a checklist and reference for automated test expectations.

Environment
- Node/npm installed
- Local Postgres with pgvector enabled
- Redis running and REDIS_URL exported
- S3 (real or localstack) configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION, S3_PUBLIC_URL)
- Embeddings proxy running (optional for deterministic embeddings)
- Env variables set: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, EMBEDDINGS_URL, REDIS_URL

Commands to prepare
1. Install deps
   npm install
2. Prisma generate and migrate
   npx prisma generate
   npx prisma migrate dev --name init
3. Seed DB
   npm run seed
4. Start embeddings proxy (optional)
   cd services/embeddings-proxy
   npm install
   OPENAI_API_KEY=sk-... EMBEDDING_DIM=1536 npm start
5. Start Redis (if needed)
   docker run -p 6379:6379 -d redis:7

Test Steps (recorded actions)

1) Request presigned URL
- Request:
  POST /api/upload/sign
  Body: { "fileName": "test-photo.jpg", "mimeType": "image/jpeg" }
- Expected response: { ok: true, uploadUrl, method: 'PUT', objectKey, publicUrl }

2) Upload object to S3
- Action:
  curl -X PUT "<uploadUrl>" -H "Content-Type: image/jpeg" --data-binary @test-photo.jpg
- Expected: HTTP 200/204 response from S3.

3) Finalize upload
- Request:
  POST /api/upload/callback
  Body: { "objectKey": "uploads/....-test-photo.jpg", "fileName": "test-photo.jpg", "mimeType":"image/jpeg", "title":"Test Photo", "tags": ["test"], "categories": ["Test"] }
- Expected response: { ok: true, image: { id, slug, url, embedding, palette, blurDataUrl, dominantColor } }
- Verified: image row present in DB with embedding vector length matching EMBEDDING_DIM.

4) Visual Echo (similar images)
- Request:
  POST /api/visual-echo/advanced
  Body: { "imageId": "<id-from-previous>", "page": 1, "limit": 12 }
- Expected: { ok: true, results: [ ... ] } sorted by hybrid score.
- Verified: results include near images (or at least return an array). Check scores between 0..1.

5) Like an image
- Authenticate (NextAuth) and GET session cookie/session
- Request:
  POST /api/like
  Body: { "imageId": "<id>" }
- Expected: { ok: true, action: 'liked' }
- DB: likes table contains new row; image.likesCount incremented.

6) Notification via SSE
- Open SSE stream:
  GET /api/notifications/stream?userId=<image.creatorId>
- Expect to see notification event pushed when someone likes the image.
- Validation: SSE message payload contains notification id and type 'LIKE'.

Observations / Errors encountered
- Ensure S3_PUBLIC_URL is set when using S3 or the stored url will fallback to the presigned upload URL which may expire.
- If embeddings proxy not running, embeddings are deterministic fallback vectors — Visual Echo still returns results but quality may be low.
- Redis must be running for rate-limit and SSE pub/sub to function across processes; otherwise in-memory fallback works only for single instance.

Automated test expectations (for CI)
- The E2E script should provision Postgres + Redis + (optional) localstack S3, run prisma migrate & seed, start services, run playwright tests, and tear down containers.


