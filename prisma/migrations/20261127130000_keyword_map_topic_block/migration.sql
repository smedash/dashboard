CREATE TABLE IF NOT EXISTS "KeywordMapTopicBlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordMapTopicBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordMapTopicBlock_projectId_key_key" ON "KeywordMapTopicBlock"("projectId", "key");

DO $$ BEGIN
    ALTER TABLE "KeywordMapTopicBlock" ADD CONSTRAINT "KeywordMapTopicBlock_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "KeywordMapProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
