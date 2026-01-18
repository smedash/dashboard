-- Migration: Add priority field to SEOMaturityItem
-- Created: $(date)

-- Add priority column to SEOMaturityItem table
ALTER TABLE "SEOMaturityItem" ADD COLUMN IF NOT EXISTS "priority" TEXT;
