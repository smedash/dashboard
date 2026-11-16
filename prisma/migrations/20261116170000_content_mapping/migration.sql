-- CreateTable
CREATE TABLE "UrlContent" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "fetchedVia" TEXT,
    "error" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "canonical" TEXT,
    "robots" TEXT,
    "lang" TEXT,
    "headings" JSONB,
    "text" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "crawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlContentSection" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "heading" TEXT,
    "headingPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UrlContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrlContent_inventoryId_key" ON "UrlContent"("inventoryId");

-- CreateIndex
CREATE INDEX "UrlContent_status_idx" ON "UrlContent"("status");

-- CreateIndex
CREATE INDEX "UrlContent_crawledAt_idx" ON "UrlContent"("crawledAt");

-- CreateIndex
CREATE INDEX "UrlContentSection_contentId_position_idx" ON "UrlContentSection"("contentId", "position");

-- AddForeignKey
ALTER TABLE "UrlContent" ADD CONSTRAINT "UrlContent_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "UrlInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlContentSection" ADD CONSTRAINT "UrlContentSection_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "UrlContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

