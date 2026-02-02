-- Migration: Deadline-Feld für Briefings hinzufügen
-- Automatisch 10 Tage nach Bestellung, änderbar durch Agentur

-- Deadline-Spalte hinzufügen
ALTER TABLE "Briefing" ADD COLUMN "deadline" TIMESTAMP(3);

-- Bestehende Briefings: Deadline auf 10 Tage nach createdAt setzen
UPDATE "Briefing" 
SET "deadline" = "createdAt" + INTERVAL '10 days'
WHERE "deadline" IS NULL;
