-- Task Management Upgrade - Von Single-Assignee zu Multi-Assignee
-- Führe dieses SQL aus, wenn du bereits migration_tasks.sql ausgeführt hast

-- 1. Neue TaskAssignee Tabelle erstellen
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- 2. Foreign Keys für TaskAssignee
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Unique Constraint
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_userId_key" UNIQUE ("taskId", "userId");

-- 4. Indices
CREATE INDEX "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- 5. Bestehende Zuweisungen migrieren (falls vorhanden)
INSERT INTO "TaskAssignee" ("id", "taskId", "userId", "createdAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    "assigneeId",
    CURRENT_TIMESTAMP
FROM "Task"
WHERE "assigneeId" IS NOT NULL;

-- 6. Alte Spalte und Foreign Key entfernen
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assigneeId_fkey";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "assigneeId";
DROP INDEX IF EXISTS "Task_assigneeId_idx";
