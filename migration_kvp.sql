-- Migration für UBS KVP (Kontinuierlicher Verbesserungsprozess)
-- Erstellt die Tabellen für KVP URLs mit Fokuskeywords, Subkeywords und Kommentaren

-- Tabelle für KVP URLs
CREATE TABLE IF NOT EXISTS "KVPUrl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "focusKeyword" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KVPUrl_pkey" PRIMARY KEY ("id")
);

-- Tabelle für KVP Subkeywords
CREATE TABLE IF NOT EXISTS "KVPSubkeyword" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KVPSubkeyword_pkey" PRIMARY KEY ("id")
);

-- Indizes
CREATE INDEX IF NOT EXISTS "KVPUrl_userId_idx" ON "KVPUrl"("userId");
CREATE INDEX IF NOT EXISTS "KVPSubkeyword_urlId_idx" ON "KVPSubkeyword"("urlId");

-- Foreign Keys
ALTER TABLE "KVPUrl" ADD CONSTRAINT "KVPUrl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KVPSubkeyword" ADD CONSTRAINT "KVPSubkeyword_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "KVPUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
