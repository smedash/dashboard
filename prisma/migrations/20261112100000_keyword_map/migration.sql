-- CreateTable
CREATE TABLE "KeywordMapProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'ch',
    "languageCode" TEXT NOT NULL DEFAULT 'de',
    "dropdownOptions" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordMapProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordMapUrl" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "h1" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "statusCode" INTEGER,
    "navigationType" TEXT,
    "pageType" TEXT,
    "funnel" TEXT,
    "targetGroup" TEXT,
    "topicAuthority" TEXT,
    "ctas" JSONB,
    "furtherLinks" JSONB,
    "subSearchVolume" INTEGER,
    "dfsTopKeyword" TEXT,
    "dfsSearchVolume" INTEGER,
    "dfsRank" INTEGER,
    "dfsKeywords" JSONB,
    "dfsFetchedAt" TIMESTAMP(3),
    "manualRank" TEXT,
    "gscClicks" INTEGER,
    "comment" TEXT,
    "kvpUrlId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordMapUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordMapKeyword" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordMapKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordMapTopicGap" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "focusKeyword" TEXT NOT NULL,
    "topicGraphId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "coverageScore" INTEGER,
    "results" JSONB,
    "summary" TEXT,
    "error" TEXT,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordMapTopicGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordMapUrl_projectId_idx" ON "KeywordMapUrl"("projectId");

-- CreateIndex
CREATE INDEX "KeywordMapUrl_kvpUrlId_idx" ON "KeywordMapUrl"("kvpUrlId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordMapUrl_projectId_url_key" ON "KeywordMapUrl"("projectId", "url");

-- CreateIndex
CREATE INDEX "KeywordMapKeyword_urlId_idx" ON "KeywordMapKeyword"("urlId");

-- CreateIndex
CREATE INDEX "KeywordMapKeyword_keyword_idx" ON "KeywordMapKeyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordMapKeyword_urlId_keyword_key" ON "KeywordMapKeyword"("urlId", "keyword");

-- CreateIndex
CREATE INDEX "KeywordMapTopicGap_urlId_createdAt_idx" ON "KeywordMapTopicGap"("urlId", "createdAt");

-- AddForeignKey
ALTER TABLE "KeywordMapUrl" ADD CONSTRAINT "KeywordMapUrl_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KeywordMapProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordMapUrl" ADD CONSTRAINT "KeywordMapUrl_kvpUrlId_fkey" FOREIGN KEY ("kvpUrlId") REFERENCES "KVPUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordMapKeyword" ADD CONSTRAINT "KeywordMapKeyword_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "KeywordMapUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordMapTopicGap" ADD CONSTRAINT "KeywordMapTopicGap_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "KeywordMapUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

