import { PrismaClient } from "@prisma/client";
import { applyCanonicalArticleStyles } from "../src/lib/article-html";

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.generatedArticle.findMany({
    select: { id: true, title: true, htmlContent: true, createdAt: true, language: true, category: true },
  });

  for (const article of articles) {
    const next = applyCanonicalArticleStyles(article.htmlContent, {
      createdAt: article.createdAt,
      language: article.language,
      category: article.category,
    });
    if (next === article.htmlContent) {
      console.log(`unverändert: ${article.title}`);
      continue;
    }
    await prisma.generatedArticle.update({
      where: { id: article.id },
      data: { htmlContent: next },
    });
    console.log(`aktualisiert: ${article.title}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
