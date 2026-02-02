-- Migration: KVP Nutzerzuweisungen
-- Ermöglicht die Zuweisung von mehreren Nutzern zu einem KVP für klare Verantwortlichkeiten

-- Tabelle für KVP-Nutzerzuweisungen (Many-to-Many)
CREATE TABLE IF NOT EXISTS "KVPAssignee" (
    "id" TEXT NOT NULL,
    "kvpUrlId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KVPAssignee_pkey" PRIMARY KEY ("id")
);

-- Unique Constraint: Ein Nutzer kann nur einmal pro KVP zugewiesen werden
CREATE UNIQUE INDEX IF NOT EXISTS "KVPAssignee_kvpUrlId_userId_key" ON "KVPAssignee"("kvpUrlId", "userId");

-- Indexes für schnelle Abfragen
CREATE INDEX IF NOT EXISTS "KVPAssignee_kvpUrlId_idx" ON "KVPAssignee"("kvpUrlId");
CREATE INDEX IF NOT EXISTS "KVPAssignee_userId_idx" ON "KVPAssignee"("userId");

-- Foreign Key Constraints
ALTER TABLE "KVPAssignee" ADD CONSTRAINT "KVPAssignee_kvpUrlId_fkey" 
    FOREIGN KEY ("kvpUrlId") REFERENCES "KVPUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KVPAssignee" ADD CONSTRAINT "KVPAssignee_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
