-- Migration: Briefings System
-- Erstellt Tabelle für SEO Content Briefings

CREATE TABLE IF NOT EXISTS "Briefing" (
    "id" TEXT NOT NULL,
    
    -- Beziehungen
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    
    -- Status
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "briefingNumber" SERIAL,
    
    -- Grunddaten
    "title" TEXT NOT NULL,
    "contentAction" TEXT NOT NULL,
    "targetAudience" TEXT,
    "funnelStage" TEXT,
    "goals" TEXT,
    
    -- Keywords & Cluster
    "focusKeyword" TEXT,
    "keywordCluster" TEXT,
    "topicCluster" TEXT,
    "searchIntent" TEXT,
    
    -- URLs
    "url" TEXT,
    "benchmarkUrls" TEXT,
    "csArticle" TEXT,
    
    -- Content-Aufbau (wird von Agentur ausgefüllt)
    "titleTag" TEXT,
    "metaDescription" TEXT,
    "navTitle" TEXT,
    "h1" TEXT,
    "mainParagraph" TEXT,
    "primaryCta" TEXT,
    "secondaryCta" TEXT,
    "inboundCta" TEXT,
    "bodyContent" TEXT,
    "internalLinks" TEXT,
    "missingTopics" TEXT,
    "notes" TEXT,
    
    -- Mehrsprachigkeit
    "titleEn" TEXT,
    "titleFr" TEXT,
    "titleIt" TEXT,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indices
CREATE INDEX IF NOT EXISTS "Briefing_requesterId_idx" ON "Briefing"("requesterId");
CREATE INDEX IF NOT EXISTS "Briefing_assigneeId_idx" ON "Briefing"("assigneeId");
CREATE INDEX IF NOT EXISTS "Briefing_status_idx" ON "Briefing"("status");
