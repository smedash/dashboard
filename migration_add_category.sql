-- Migration: Add category field to RankTrackerKeyword
-- Created: 2025-01-13

-- Add category column if it doesn't exist
ALTER TABLE "RankTrackerKeyword" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Create index on category
CREATE INDEX IF NOT EXISTS "RankTrackerKeyword_category_idx" ON "RankTrackerKeyword"("category");
