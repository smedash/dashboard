-- Migration: KVP-Reifegrad-Verknüpfung
-- Many-to-Many-Beziehung zwischen KVPUrl und SEOMaturityItem

-- Erstelle die Verknüpfungstabelle
CREATE TABLE IF NOT EXISTS "KVPMaturityItemLink" (
    "id" TEXT NOT NULL,
    "kvpUrlId" TEXT NOT NULL,
    "maturityItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KVPMaturityItemLink_pkey" PRIMARY KEY ("id")
);

-- Unique Constraint: Ein KVP kann nur einmal pro Maturity Item verknüpft werden
CREATE UNIQUE INDEX IF NOT EXISTS "KVPMaturityItemLink_kvpUrlId_maturityItemId_key" ON "KVPMaturityItemLink"("kvpUrlId", "maturityItemId");

-- Indexe für schnelle Abfragen
CREATE INDEX IF NOT EXISTS "KVPMaturityItemLink_kvpUrlId_idx" ON "KVPMaturityItemLink"("kvpUrlId");
CREATE INDEX IF NOT EXISTS "KVPMaturityItemLink_maturityItemId_idx" ON "KVPMaturityItemLink"("maturityItemId");

-- Foreign Key Constraints
ALTER TABLE "KVPMaturityItemLink" ADD CONSTRAINT "KVPMaturityItemLink_kvpUrlId_fkey" 
    FOREIGN KEY ("kvpUrlId") REFERENCES "KVPUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KVPMaturityItemLink" ADD CONSTRAINT "KVPMaturityItemLink_maturityItemId_fkey" 
    FOREIGN KEY ("maturityItemId") REFERENCES "SEOMaturityItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
