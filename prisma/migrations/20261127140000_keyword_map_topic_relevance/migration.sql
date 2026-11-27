ALTER TABLE "KeywordMapProject" ADD COLUMN IF NOT EXISTS "coreDescription" TEXT;

CREATE TABLE IF NOT EXISTS "KeywordMapTopicRelevance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "llmScore" INTEGER,
    "tier" TEXT,
    "reason" TEXT,
    "similarity" DOUBLE PRECISION,
    "profileHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KeywordMapTopicRelevance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordMapTopicRelevance_projectId_key_key" ON "KeywordMapTopicRelevance"("projectId", "key");

DO $$ BEGIN
    ALTER TABLE "KeywordMapTopicRelevance" ADD CONSTRAINT "KeywordMapTopicRelevance_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "KeywordMapProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
