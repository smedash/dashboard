-- CreateTable
CREATE TABLE "UrlCheckHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "keyword" TEXT,
    "overallScore" INTEGER NOT NULL,
    "categoryScores" TEXT NOT NULL,
    "fullResult" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlCheckHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlCheckMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "keyword" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckAt" TIMESTAMP(3),
    "lastScore" INTEGER,
    "alertThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlCheckMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlCheckHistory_userId_url_idx" ON "UrlCheckHistory"("userId", "url");
CREATE INDEX "UrlCheckHistory_url_createdAt_idx" ON "UrlCheckHistory"("url", "createdAt");
CREATE INDEX "UrlCheckHistory_userId_createdAt_idx" ON "UrlCheckHistory"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UrlCheckMonitor_userId_url_key" ON "UrlCheckMonitor"("userId", "url");
CREATE INDEX "UrlCheckMonitor_isActive_frequency_idx" ON "UrlCheckMonitor"("isActive", "frequency");
CREATE INDEX "UrlCheckMonitor_userId_idx" ON "UrlCheckMonitor"("userId");
