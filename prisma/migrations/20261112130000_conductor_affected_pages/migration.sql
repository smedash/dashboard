ALTER TABLE "ConductorWebsite" ADD COLUMN IF NOT EXISTS "pageIssuesBasis" TIMESTAMP(3);
ALTER TABLE "ConductorWebsite" ADD COLUMN IF NOT EXISTS "pageIssuesCursorIssue" TEXT;
ALTER TABLE "ConductorWebsite" ADD COLUMN IF NOT EXISTS "pageIssuesCursorPage" INTEGER;
ALTER TABLE "ConductorWebsite" ADD COLUMN IF NOT EXISTS "pageIssuesSyncedAt" TIMESTAMP(3);
ALTER TABLE "ConductorWebsite" ADD COLUMN IF NOT EXISTS "pageIssuesLockedUntil" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ConductorPageIssueStage" (
    "websiteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    CONSTRAINT "ConductorPageIssueStage_pkey" PRIMARY KEY ("pageId", "issue"),
    CONSTRAINT "ConductorPageIssueStage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "ConductorWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConductorPageIssueStage_websiteId_idx" ON "ConductorPageIssueStage"("websiteId");
