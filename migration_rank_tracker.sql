-- Migration: Add Rank Tracker Tables
-- Created: 2025-01-13

-- Create RankTracker table
CREATE TABLE IF NOT EXISTS "RankTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Standard Tracker',
    "location" TEXT NOT NULL DEFAULT 'Switzerland',
    "language" TEXT NOT NULL DEFAULT 'German',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankTracker_pkey" PRIMARY KEY ("id")
);

-- Create RankTrackerKeyword table
CREATE TABLE IF NOT EXISTS "RankTrackerKeyword" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankTrackerKeyword_pkey" PRIMARY KEY ("id")
);

-- Create RankTrackerRanking table
CREATE TABLE IF NOT EXISTS "RankTrackerRanking" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "position" INTEGER,
    "url" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankTrackerRanking_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraints
ALTER TABLE "RankTracker" ADD CONSTRAINT "RankTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RankTrackerKeyword" ADD CONSTRAINT "RankTrackerKeyword_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "RankTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RankTrackerRanking" ADD CONSTRAINT "RankTrackerRanking_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "RankTrackerKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "RankTracker_userId_idx" ON "RankTracker"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "RankTrackerKeyword_trackerId_keyword_key" ON "RankTrackerKeyword"("trackerId", "keyword");

CREATE INDEX IF NOT EXISTS "RankTrackerKeyword_trackerId_idx" ON "RankTrackerKeyword"("trackerId");

CREATE INDEX IF NOT EXISTS "RankTrackerKeyword_category_idx" ON "RankTrackerKeyword"("category");

CREATE INDEX IF NOT EXISTS "RankTrackerRanking_keywordId_date_idx" ON "RankTrackerRanking"("keywordId", "date");

CREATE INDEX IF NOT EXISTS "RankTrackerRanking_date_idx" ON "RankTrackerRanking"("date");
