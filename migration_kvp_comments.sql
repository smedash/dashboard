-- Migration für KVP Kommentare
-- Erstellt die Tabelle für mehrere Kommentare pro KVP URL

-- Tabelle für KVP Kommentare
CREATE TABLE IF NOT EXISTS "KVPComment" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KVPComment_pkey" PRIMARY KEY ("id")
);

-- Index
CREATE INDEX IF NOT EXISTS "KVPComment_urlId_idx" ON "KVPComment"("urlId");

-- Foreign Key
ALTER TABLE "KVPComment" ADD CONSTRAINT "KVPComment_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "KVPUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
