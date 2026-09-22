-- AlterTable
ALTER TABLE "EditorialPlanArticle" ADD COLUMN "contentPushed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EditorialPlanArticle" ADD COLUMN "contentPushedAt" TIMESTAMP(3);
ALTER TABLE "EditorialPlanArticle" ADD COLUMN "articleId" TEXT;

-- CreateTable
CREATE TABLE "GeneratedArticle" (
    "id" TEXT NOT NULL,
    "contentNumber" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "funnelStage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "language" TEXT,
    "targetAudience" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'draft',
    "revisionRequestedAt" TIMESTAMP(3),
    "revisionRequestedBy" TEXT,
    "reviewStepDueAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "claimedByName" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleImage" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "selectedText" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "changeAndForward" BOOLEAN NOT NULL DEFAULT false,
    "recheckAfterRevision" BOOLEAN NOT NULL DEFAULT false,
    "anchorId" TEXT,
    "textOffset" INTEGER,
    "contextPrefix" TEXT,
    "contextSuffix" TEXT,
    "paragraphIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleStatusHistory" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedByEmail" TEXT NOT NULL,
    "changedByName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedArticle_contentNumber_key" ON "GeneratedArticle"("contentNumber");
CREATE UNIQUE INDEX "GeneratedArticle_slug_key" ON "GeneratedArticle"("slug");
CREATE INDEX "GeneratedArticle_creatorId_idx" ON "GeneratedArticle"("creatorId");
CREATE INDEX "GeneratedArticle_funnelStage_idx" ON "GeneratedArticle"("funnelStage");
CREATE INDEX "GeneratedArticle_category_idx" ON "GeneratedArticle"("category");
CREATE INDEX "GeneratedArticle_reviewStatus_idx" ON "GeneratedArticle"("reviewStatus");
CREATE INDEX "GeneratedArticle_createdAt_idx" ON "GeneratedArticle"("createdAt");

CREATE INDEX "ArticleImage_articleId_idx" ON "ArticleImage"("articleId");

CREATE INDEX "ContentComment_articleId_idx" ON "ContentComment"("articleId");
CREATE INDEX "ContentComment_authorId_idx" ON "ContentComment"("authorId");
CREATE INDEX "ContentComment_resolved_idx" ON "ContentComment"("resolved");
CREATE INDEX "ContentComment_resolvedById_idx" ON "ContentComment"("resolvedById");

CREATE INDEX "ArticleStatusHistory_articleId_idx" ON "ArticleStatusHistory"("articleId");
CREATE INDEX "ArticleStatusHistory_createdAt_idx" ON "ArticleStatusHistory"("createdAt");

CREATE UNIQUE INDEX "EditorialPlanArticle_articleId_key" ON "EditorialPlanArticle"("articleId");

-- AddForeignKey
ALTER TABLE "EditorialPlanArticle" ADD CONSTRAINT "EditorialPlanArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "GeneratedArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedArticle" ADD CONSTRAINT "GeneratedArticle_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "GeneratedArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "GeneratedArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ArticleStatusHistory" ADD CONSTRAINT "ArticleStatusHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "GeneratedArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
