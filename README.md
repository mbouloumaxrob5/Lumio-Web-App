# Lumio — Visual Sanctuary

This repository contains the Lumio Web App: a premium visual-sharing platform built with Next.js 15, TypeScript, Prisma/Postgres (pgvector), Uploadthing, Auth.js (NextAuth v5) and a modern frontend stack.

Quick start

1. Copy .env.example to .env and fill DATABASE_URL and other keys (GOOGLE_CLIENT_ID, UPLOADTHING_SECRET, etc.).
2. Install dependencies
   - npm install
3. Ensure your Postgres instance allows creating extensions or create the pgvector extension manually:
   - psql <your-db> -c "CREATE EXTENSION IF NOT EXISTS vector;"
4. Generate Prisma Client and run migrations
   - npx prisma generate
   - npx prisma migrate dev --name init
5. Seed the database
   - npm run seed

Notes
- The seed script includes a step to CREATE EXTENSION IF NOT EXISTS vector; but your DB user may not have permission. If the command fails, create the extension manually as shown above.
- For image uploads in production we recommend Uploadthing; seed images reference /public/assets/seed and should be replaced by actual uploads via the provided script (scripts/image-seed-uploader.ts) — to be added.

Next steps I will perform if you confirm:
- Run the first migration and seed (if you want me to push migration files and attempt to run migrations locally, confirm DB access — otherwise I will add migration instructions and create PRs with the code). 
- Implement /lib/auth and NextAuth configuration.
- Add Uploadthing integration and an upload seed script.
