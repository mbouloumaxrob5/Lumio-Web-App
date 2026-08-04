# Lumio — Runbook d'installation et configuration

Ce document rassemble toutes les instructions pour lancer Lumio localement ou en préproduction, configurer les variables d'environnement, utiliser les outils ajoutés (embeddings proxy, Redis, S3 presign, autotune IVFFLAT), exécuter les tests et réaliser les opérations courantes.

---

## 1. Prérequis
- Node.js 18+ et npm
- PostgreSQL (avec extension pgvector)
- Redis (pour SSE, rate-limiter, queue)
- Accès S3 (AWS) si presigned upload utilisé
- (Optionnel) GPU + Docker pour inference locale
- Outils dev: prisma, ts-node, Playwright

Commandes rapides (mac/linux):
- Installer Redis localement : `docker run -p 6379:6379 -d redis:7`
- Installer Postgres localement : `docker run --name lumio-postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres:15`

---

## 2. Installer et démarrer le projet
1. Cloner le repo et installer dépendances
   npm install

2. Générer Prisma client
   npx prisma generate

3. Appliquer migrations (dev)
   npx prisma migrate dev --name init

4. Seed initial (users / images)
   npm run seed

5. Lancer le serveur de développement
   npm run dev

6. (Optionnel) Lancer le proxy d'embeddings local
   cd services/embeddings-proxy
   npm install
   OPENAI_API_KEY=sk-... EMBEDDING_DIM=1536 npm start

---

## 3. Variables d'environnement (fichier .env)
Crée un fichier `.env` à la racine (NE PAS committer de secrets). Exemple ci‑dessous :

DATABASE_URL="postgresql://user:pass@host:5432/lumio?schema=public"
NEXTAUTH_SECRET="une-chaine-tres-longue-et-secrete"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_ID=""
GITHUB_SECRET=""
EMBEDDINGS_URL="http://localhost:8080"
EMBEDDING_DIM=1536
OPENAI_API_KEY=""              # optionnel pour proxy
UPLOADTHING_ENDPOINT=""        # fallback optionnel
UPLOADTHING_API_KEY=""         # fallback optionnel
UPLOAD_MAX_BYTES=15728640       # 15MB
UPLOAD_ALLOWED_MIME="image/jpeg,image/png,image/webp,image/avif"
UPLOAD_RATE_MAX=10
UPLOAD_RATE_WINDOW_MS=3600000
NEXT_PUBLIC_UPLOAD_MAX_SIZE=15728640
REDIS_URL="redis://localhost:6379"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
S3_BUCKET=""
S3_REGION="us-east-1"
S3_PUBLIC_URL="https://your-bucket.s3.us-east-1.amazonaws.com"
SENTRY_DSN=""
DATADOG_API_KEY=""

Explications rapides :
- DATABASE_URL : string de connexion Postgres utilisé par Prisma.
- NEXTAUTH_SECRET : clé secrète NextAuth (générer via crypto.randomBytes(32)).
- EMBEDDINGS_URL : endpoint du proxy d'embeddings (local ou distant).
- REDIS_URL : nécessaire en prod pour rate-limiter distribué et SSE pub/sub.
- S3_* : informations pour le flow presigned PUT (si utilisé).

---

## 4. Flux d'upload (résumé)
1. Client demande presign : POST /api/upload/sign (fileName, mimeType)
2. Si S3 configuré : serveur renvoie uploadUrl (presigned PUT), objectKey, publicUrl
3. Client effectue PUT direct sur uploadUrl
4. Client appelle POST /api/upload/callback avec objectKey ou url + metadata
5. Serveur télécharge (ou lit S3), valide (magic-bytes, taille), extrait blurData/palette, appelle embeddings, écrit en DB et attache tags/categories

Exemples rapides (curl) :
- Obtenir presign :
  curl -X POST http://localhost:3000/api/upload/sign -H "Content-Type: application/json" -d '{"fileName":"photo.jpg","mimeType":"image/jpeg"}'

- Uploader vers S3 :
  curl -X PUT "<uploadUrl>" -H "Content-Type: image/jpeg" --data-binary @photo.jpg

- Finaliser :
  curl -X POST http://localhost:3000/api/upload/callback -H "Content-Type: application/json" -d '{"objectKey":"uploads/..-photo.jpg","fileName":"photo.jpg","mimeType":"image/jpeg","title":"Mon image"}'

---

## 5. Embeddings et seed
- Le seed initial remplit la DB avec des images d'exemple (embeddings déterministes si proxy non configuré).
- Pour embeddings réels, démarre le proxy d'embeddings avec OPENAI_API_KEY ou utilise un fournisseur.
- Le script `scripts/image-seed-uploader.ts` upload des images, génère blurData/palette et stocke embeddings via EMBEDDINGS_URL.

---

## 6. Indexation pgvector IVFFLAT & autotune
Scripts disponibles :
- `prisma/sql/create_ivfflat_index.sql` — SQL pour créer index IVFFLAT (lists = 100 par défaut)
- `scripts/benchmark-ivfflat.ts` — bench KNN simple
- `scripts/ivfflat-autotune.ts` — autotune : crée index temporaires pour plusieurs lists, bench et recommande

Exemple autotune :
  npx ts-node scripts/ivfflat-autotune.ts --tryLists=16,64,100,256 --runs=50 --limit=10

Pour persister l'index recommandé :
  psql "<DATABASE_URL>" -c "CREATE INDEX CONCURRENTLY image_embedding_ivfflat ON \"Image\" USING ivfflat (embedding vector_l2_ops) WITH (lists = <RECOMMENDED>)"
  psql "<DATABASE_URL>" -c 'ANALYZE "Image";'

---

## 7. Tests
- Unit (Vitest) : `npm run test`
- E2E (Playwright) : démarrer le serveur (`npm run dev`) puis `npx playwright test`

Les tests E2E sont skeletons; pour tests réels, ajouter fixtures (fichiers, sessions auth).

---

## 8. Observabilité & monitoring (recommandé)
- Instrumenter : upload latency, finalize duration, embedding latency, KNN latency, rate-limit hits
- Tracing distribué : OpenTelemetry
- Alertes proposées : upload fail rate > 5% (5m), embedding latency p95 > 2s, KNN p95 > 300ms

---

## 9. Sécurité & bonnes pratiques
- Ne stocke pas de secrets dans le repo
- IAM least-privilege pour S3 (presign PUT sur préfixe uploads/)
- Rate-limits et quotas par utilisateur
- Virus scanning (ClamAV) possible en post-finalize
- Consentement + opt-out pour détection visage/marque

---

## 10. Exemples d'opérations courantes
- Lancer Redis : `docker run -p 6379:6379 -d redis:7`
- Lancer embeddings proxy : voir `services/embeddings-proxy/README.md`
- Lancer autotune : `npx ts-node scripts/ivfflat-autotune.ts` (voir docs/IVFFLAT_AUTOTUNE.md)

---

## 11. Ressources & docs complémentaires
- docs/IVFFLAT_BENCH.md
- docs/IVFFLAT_AUTOTUNE.md
- docs/E2E_REPORT.md
- docs/OPERATION_PLAYBOOK.md

---

Si tu veux que je pousse ce fichier ailleurs (ex : `README.md` à la racine, `docs/RUNBOOK.md` ou format markdown plus court), dis‑le et je m'en occupe.
