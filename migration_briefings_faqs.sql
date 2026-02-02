-- Migration: FAQs-Feld zu Briefings hinzufügen
-- Nur ausführen wenn Briefing-Tabelle bereits existiert

ALTER TABLE "Briefing" ADD COLUMN IF NOT EXISTS "faqs" TEXT;
