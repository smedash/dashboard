-- Migration: Keywordset/Longtail und Topiccluster Felder für Briefings hinzufügen

-- Keywordset/Longtail Spalte hinzufügen
ALTER TABLE "Briefing" ADD COLUMN "keywordsetLongtail" TEXT;

-- Topiccluster für Content Spalte hinzufügen
ALTER TABLE "Briefing" ADD COLUMN "topicclusterContent" TEXT;
