ALTER TABLE "ConductorPage" ADD COLUMN IF NOT EXISTS "appUrl" TEXT;
ALTER TABLE "ConductorPage" ADD COLUMN IF NOT EXISTS "issuesSyncedAt" TIMESTAMP(3);
ALTER TABLE "ConductorPage" ADD COLUMN IF NOT EXISTS "openIssues" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "ConductorPage_websiteId_type_issuesSyncedAt_idx" ON "ConductorPage"("websiteId", "type", "issuesSyncedAt");
CREATE INDEX IF NOT EXISTS "ConductorPage_openIssues_idx" ON "ConductorPage" USING GIN ("openIssues");
