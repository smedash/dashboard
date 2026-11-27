CREATE TABLE IF NOT EXISTS "KeywordMapSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "excludedBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KeywordMapSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KeywordMapTopicGap" ADD COLUMN IF NOT EXISTS "excludedResults" JSONB;
