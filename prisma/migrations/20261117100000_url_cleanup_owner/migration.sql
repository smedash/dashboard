ALTER TABLE "UrlInventory" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "UrlInventory" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT;
ALTER TABLE "UrlInventory" ADD COLUMN IF NOT EXISTS "ownerUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "UrlInventory_ownerEmail_idx" ON "UrlInventory"("ownerEmail");
CREATE INDEX IF NOT EXISTS "UrlInventory_ownerName_idx" ON "UrlInventory"("ownerName");
