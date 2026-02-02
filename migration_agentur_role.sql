-- Migration für Agentur-Rolle
-- Diese Migration ist rein dokumentarisch - keine DB-Änderungen nötig
-- Das role-Feld ist bereits ein TEXT-Feld, das beliebige Werte akzeptiert

-- Verfügbare Rollen nach dieser Migration:
-- - superadmin: Volle Rechte - kann Nutzer verwalten und alle Inhalte bearbeiten
-- - agentur: Volle Rechte - kann Nutzer verwalten und alle Inhalte bearbeiten (wie Superadmin)
-- - member: Kann alle Inhalte sehen und bearbeiten
-- - viewer: Kann nur lesen

-- Um einen bestehenden User zur Agentur-Rolle zu ändern:
-- UPDATE "User" SET "role" = 'agentur' WHERE "email" = 'agentur@example.com';

-- Um alle Agentur-User abzufragen:
-- SELECT * FROM "User" WHERE "role" = 'agentur';
