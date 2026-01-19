-- Migration für RBAC (Role-Based Access Control)
-- Bitte in Neon Console ausführen

-- 1. Füge das role Feld zur User Tabelle hinzu (mit Default "member")
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'member';

-- 2. Setze alle bestehenden User auf "superadmin" (wie angefordert)
UPDATE "User" SET "role" = 'superadmin' WHERE "role" = 'member';

-- 3. Index für bessere Performance bei Rollenabfragen
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Hinweis: Nach dieser Migration sind alle bestehenden User Superadmins.
-- Neue User werden standardmäßig als "member" angelegt.
-- 
-- Verfügbare Rollen:
-- - superadmin: Volle Rechte (kann Nutzer verwalten)
-- - member: Kann alle Inhalte bearbeiten
-- - viewer: Kann nur lesen
