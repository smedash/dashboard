-- Migration: Add SEO Reifegrad Tables
-- Created: $(date)

-- Create SEOMaturity table
CREATE TABLE IF NOT EXISTS "SEOMaturity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SEOMaturity_pkey" PRIMARY KEY ("id")
);

-- Create SEOMaturityItem table
CREATE TABLE IF NOT EXISTS "SEOMaturityItem" (
    "id" TEXT NOT NULL,
    "maturityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "score" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SEOMaturityItem_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraint for SEOMaturity.userId -> User.id
ALTER TABLE "SEOMaturity" ADD CONSTRAINT "SEOMaturity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create foreign key constraint for SEOMaturityItem.maturityId -> SEOMaturity.id
ALTER TABLE "SEOMaturityItem" ADD CONSTRAINT "SEOMaturityItem_maturityId_fkey" FOREIGN KEY ("maturityId") REFERENCES "SEOMaturity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index on SEOMaturity.userId
CREATE INDEX IF NOT EXISTS "SEOMaturity_userId_idx" ON "SEOMaturity"("userId");

-- Create index on SEOMaturityItem.maturityId and category
CREATE INDEX IF NOT EXISTS "SEOMaturityItem_maturityId_category_idx" ON "SEOMaturityItem"("maturityId", "category");
