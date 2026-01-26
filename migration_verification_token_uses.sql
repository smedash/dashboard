-- Migration: Add usesRemaining to VerificationToken
-- Purpose: Allow magic link tokens to be used twice to protect against mail scanner clicks
-- Date: 2026-01-26

-- Add usesRemaining column with default value of 2
ALTER TABLE "VerificationToken" 
ADD COLUMN IF NOT EXISTS "usesRemaining" INTEGER NOT NULL DEFAULT 2;

-- Update existing tokens to have 2 uses remaining
UPDATE "VerificationToken" 
SET "usesRemaining" = 2 
WHERE "usesRemaining" IS NULL;
