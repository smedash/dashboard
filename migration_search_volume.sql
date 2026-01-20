-- Migration: Search Volume für Rank Tracker Keywords
-- Fügt Suchvolumen-Feld zum RankTrackerKeyword hinzu

-- Füge searchVolume Spalte hinzu
ALTER TABLE "RankTrackerKeyword" ADD COLUMN IF NOT EXISTS "searchVolume" INTEGER;

-- Füge searchVolumeUpdatedAt Spalte hinzu
ALTER TABLE "RankTrackerKeyword" ADD COLUMN IF NOT EXISTS "searchVolumeUpdatedAt" TIMESTAMP(3);
