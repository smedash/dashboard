-- Task Management / Kanban Board Migration
-- Führe dieses SQL in der Neon PostgreSQL Datenbank aus

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
    "assigneeId" TEXT, -- Zugewiesener Bearbeiter
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
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
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indices für Performance
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_category_idx" ON "Task"("category");
CREATE INDEX "Task_status_order_idx" ON "Task"("status", "order");
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");
