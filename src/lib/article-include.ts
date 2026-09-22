import { Prisma } from "@prisma/client";

export const articleDetailInclude = {
  creator: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "desc" as const },
    include: {
      author: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
  },
  images: {
    orderBy: { createdAt: "desc" as const },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.GeneratedArticleInclude;
