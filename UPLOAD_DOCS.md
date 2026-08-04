# Uploadthing and Embeddings

This file documents the seed uploader and embeddings integration.

Usage

1. Ensure dependencies are installed:
   npm install

2. Optional: set environment variables to enable Uploadthing and local embeddings provider
   - UPLOADTHING_ENDPOINT: HTTP endpoint that accepts file uploads (the uploader sends a multipart/form-data POST with field 'file')
   - UPLOADTHING_API_KEY: API key sent as x-api-key header
   - EMBEDDINGS_URL: base URL of a local embeddings provider (must accept POST /embed with { text, imagePath } and respond with { embedding: number[] })
   - EMBEDDING_DIM: dimension of embeddings (default 1536)

3. Place seed images in public/assets/seed

4. Run the uploader:
   npm run prisma:generate
   ts-node scripts/image-seed-uploader.ts

If UPLOADTHING_* variables are not set the uploader will keep the image URL as the local path under /assets/seed.
