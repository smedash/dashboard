-- Migration für KVP Kategorie
-- Fügt ein category Feld zum KVPUrl Modell hinzu

-- Spalte hinzufügen
ALTER TABLE "KVPUrl" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Index erstellen
CREATE INDEX IF NOT EXISTS "KVPUrl_category_idx" ON "KVPUrl"("category");
