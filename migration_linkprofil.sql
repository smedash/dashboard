-- Migration: Linkprofil-Tabellen für gespeicherte Backlink-Daten
-- Target ist immer ubs.com (hardcoded)

-- BacklinkProfile Tabelle - Speichert Summary-Daten
CREATE TABLE IF NOT EXISTS "BacklinkProfile" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'ubs.com',
    "totalBacklinks" INTEGER NOT NULL DEFAULT 0,
    "totalReferringDomains" INTEGER NOT NULL DEFAULT 0,
    "totalReferringMainDomains" INTEGER NOT NULL DEFAULT 0,
    "totalReferringIps" INTEGER NOT NULL DEFAULT 0,
    "totalReferringSubnets" INTEGER NOT NULL DEFAULT 0,
    "dofollow" INTEGER NOT NULL DEFAULT 0,
    "nofollow" INTEGER NOT NULL DEFAULT 0,
    "newBacklinks" INTEGER NOT NULL DEFAULT 0,
    "lostBacklinks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklinkProfile_pkey" PRIMARY KEY ("id")
);

-- Backlink Tabelle - Einzelne Backlinks
CREATE TABLE IF NOT EXISTS "Backlink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "domainFrom" TEXT NOT NULL,
    "urlFrom" TEXT NOT NULL,
    "urlTo" TEXT NOT NULL,
    "tldFrom" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "pageFromRank" INTEGER NOT NULL DEFAULT 0,
    "domainFromRank" INTEGER NOT NULL DEFAULT 0,
    "domainFromCountry" TEXT,
    "pageFromTitle" TEXT,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "itemType" TEXT,
    "dofollow" BOOLEAN NOT NULL DEFAULT true,
    "anchor" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "backlinkSpamScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backlink_pkey" PRIMARY KEY ("id")
);

-- ReferringDomain Tabelle - Verweisende Domains
CREATE TABLE IF NOT EXISTS "ReferringDomain" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "firstSeen" TIMESTAMP(3),
    "backlinksSpamScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferringDomain_pkey" PRIMARY KEY ("id")
);

-- Unique Constraint für ReferringDomain
ALTER TABLE "ReferringDomain" ADD CONSTRAINT "ReferringDomain_profileId_domain_key" UNIQUE ("profileId", "domain");

-- Foreign Keys
ALTER TABLE "Backlink" ADD CONSTRAINT "Backlink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BacklinkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferringDomain" ADD CONSTRAINT "ReferringDomain_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BacklinkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS "BacklinkProfile_target_idx" ON "BacklinkProfile"("target");
CREATE INDEX IF NOT EXISTS "Backlink_profileId_idx" ON "Backlink"("profileId");
CREATE INDEX IF NOT EXISTS "Backlink_domainFrom_idx" ON "Backlink"("domainFrom");
CREATE INDEX IF NOT EXISTS "Backlink_dofollow_idx" ON "Backlink"("dofollow");
CREATE INDEX IF NOT EXISTS "Backlink_isNew_idx" ON "Backlink"("isNew");
CREATE INDEX IF NOT EXISTS "Backlink_isLost_idx" ON "Backlink"("isLost");
CREATE INDEX IF NOT EXISTS "ReferringDomain_profileId_idx" ON "ReferringDomain"("profileId");
CREATE INDEX IF NOT EXISTS "ReferringDomain_rank_idx" ON "ReferringDomain"("rank");
