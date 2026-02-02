-- Migration: Briefing Types (Vorlagen)
-- Fügt briefingType Feld und Lexikon-spezifische Felder hinzu

-- Briefing-Typ Feld hinzufügen
ALTER TABLE "Briefing" ADD COLUMN IF NOT EXISTS "briefingType" TEXT NOT NULL DEFAULT 'new_content';

-- Lexikon-spezifische Felder hinzufügen
ALTER TABLE "Briefing" ADD COLUMN IF NOT EXISTS "lexiconDefinition" TEXT;
ALTER TABLE "Briefing" ADD COLUMN IF NOT EXISTS "lexiconSynonyms" TEXT;
ALTER TABLE "Briefing" ADD COLUMN IF NOT EXISTS "lexiconRelated" TEXT;

-- Index für briefingType
CREATE INDEX IF NOT EXISTS "Briefing_briefingType_idx" ON "Briefing"("briefingType");

-- Bestehende Briefings auf Basis von contentAction migrieren:
-- "new" -> "new_content", "edit"/"merge" -> "edit_content"
UPDATE "Briefing" SET "briefingType" = 
  CASE 
    WHEN "contentAction" = 'new' THEN 'new_content'
    ELSE 'edit_content'
  END
WHERE "briefingType" = 'new_content';
