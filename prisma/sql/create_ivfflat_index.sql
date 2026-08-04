-- prisma/sql/create_ivfflat_index.sql
-- Creates an IVFFLAT index on the Image.embedding pgvector column using L2 (euclidean) ops.
-- Adjust `lists` according to dataset size and available memory. Typical guidance:
--  - small datasets (<10k): lists = 16
--  - medium datasets (10k-100k): lists = 64
--  - large datasets (100k+): lists = 100 .. 1000

CREATE EXTENSION IF NOT EXISTS vector;

-- Create index if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'image_embedding_ivfflat'
  ) THEN
    RAISE NOTICE 'Creating ivfflat index on "Image"(embedding)';
    EXECUTE 'CREATE INDEX image_embedding_ivfflat ON "Image" USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)';
  ELSE
    RAISE NOTICE 'Index image_embedding_ivfflat already exists';
  END IF;
END$$;

-- Recommended: analyze table after index creation for planner stats
ANALYZE "Image";
