CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "UrlContentSection" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
CREATE INDEX IF NOT EXISTS "UrlContentSection_embedding_idx" ON "UrlContentSection" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "KeywordMapTopicGap" ADD COLUMN IF NOT EXISTS "crossCoverageError" TEXT;
