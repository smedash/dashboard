-- Migration: Add category field to Briefing table
-- Die gleichen Kategorien wie bei KVP: Mortgages, Accounts&Cards, Investing, Pension, Digital Banking

ALTER TABLE "Briefing" ADD COLUMN "category" TEXT;

-- Optional: Index für schnellere Abfragen nach Kategorie
CREATE INDEX "Briefing_category_idx" ON "Briefing"("category");
