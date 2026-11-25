-- Prisma kennt weder die Extension noch HNSW-Indizes: `prisma db push` löscht den Index.
-- `npm run db:push` führt diese Datei deshalb vor und nach dem Push aus.
CREATE EXTENSION IF NOT EXISTS vector;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'UrlContentSection' AND column_name = 'embedding') THEN
    CREATE INDEX IF NOT EXISTS "UrlContentSection_embedding_idx" ON "UrlContentSection" USING hnsw ("embedding" vector_cosine_ops);
  END IF;
END $$;
