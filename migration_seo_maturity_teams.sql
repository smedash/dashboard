-- Migration: Add Teams to SEO Reifegrad Items
-- Created: $(date)

-- Create Team table
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on Team.name
CREATE UNIQUE INDEX IF NOT EXISTS "Team_name_key" ON "Team"("name");

-- Create SEOMaturityItemTeam join table
CREATE TABLE IF NOT EXISTS "SEOMaturityItemTeam" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SEOMaturityItemTeam_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraint for SEOMaturityItemTeam.itemId -> SEOMaturityItem.id
ALTER TABLE "SEOMaturityItemTeam" ADD CONSTRAINT "SEOMaturityItemTeam_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SEOMaturityItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create foreign key constraint for SEOMaturityItemTeam.teamId -> Team.id
ALTER TABLE "SEOMaturityItemTeam" ADD CONSTRAINT "SEOMaturityItemTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique constraint on itemId and teamId
CREATE UNIQUE INDEX IF NOT EXISTS "SEOMaturityItemTeam_itemId_teamId_key" ON "SEOMaturityItemTeam"("itemId", "teamId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "SEOMaturityItemTeam_itemId_idx" ON "SEOMaturityItemTeam"("itemId");
CREATE INDEX IF NOT EXISTS "SEOMaturityItemTeam_teamId_idx" ON "SEOMaturityItemTeam"("teamId");

-- Insert default teams
INSERT INTO "Team" ("id", "name", "createdAt", "updatedAt")
VALUES 
    ('team_content_factory', 'Content Factory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('team_seo_onsite', 'SEO & Onsite-Steering', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('team_channels', 'Channels & Plattform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
