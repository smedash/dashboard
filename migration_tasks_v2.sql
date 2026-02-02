-- Task Management v2 - Multi-Assignee Migration
-- Führe dieses SQL in der Neon PostgreSQL Datenbank aus
-- ACHTUNG: Nur ausführen wenn du die erste Migration (migration_tasks.sql) noch NICHT ausgeführt hast!
-- Falls doch, nutze migration_tasks_upgrade.sql

-- Task Model - Aufgabenverwaltung im Kanban-Stil
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog', -- backlog, todo, in_progress, review, done
    "priority" TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    "order" INTEGER NOT NULL DEFAULT 0, -- Reihenfolge innerhalb der Spalte für Drag & Drop
    "dueDate" TIMESTAMP(3),
    "category" TEXT, -- Kategorie: Mortgages, Accounts&Cards, Investing, Pension, Digital Banking
    "labels" TEXT[], -- Zusätzliche Labels/Tags
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- Task Assignees - Many-to-Many Beziehung für mehrere Zuweisungen
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- Task Comments - Kommentare zu Tasks
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique Constraint für TaskAssignee (ein User kann nur einmal pro Task zugewiesen sein)
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_userId_key" UNIQUE ("taskId", "userId");

-- Indices für Performance
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_category_idx" ON "Task"("category");
CREATE INDEX "Task_status_order_idx" ON "Task"("status", "order");
CREATE INDEX "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");
