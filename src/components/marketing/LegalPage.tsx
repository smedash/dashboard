import type { Metadata } from "next";
import Link from "next/link";
import { getMessages } from "@/i18n/server";
import { legalMessages, type LegalBlock, type LegalDocument } from "@/i18n/messages/legal";
import { SGsuiteMark, SGsuiteWordmark } from "@/components/ui/SGsuiteLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MarketingFooter } from "./MarketingFooter";

type LegalDocumentKey = "imprint" | "privacy" | "terms";

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className="mt-3 leading-relaxed text-slate-400 whitespace-pre-line">{block}</p>;
  }
  if ("subheading" in block) {
    return <h3 className="mt-6 font-semibold text-slate-200">{block.subheading}</h3>;
  }
  return (
    <ul className="mt-3 space-y-2 list-disc pl-5 marker:text-blue-400 leading-relaxed text-slate-400">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export async function getLegalMetadata(key: LegalDocumentKey): Promise<Metadata> {
  const doc = (await getMessages(legalMessages))[key];
  return { title: `${doc.title} – SGsuite`, description: doc.description };
}

export async function LegalPage({ doc: key }: { doc: LegalDocumentKey }) {
  const t = await getMessages(legalMessages);
  const doc: LegalDocument = t[key];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-300">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="SGsuite">
            <SGsuiteMark className="w-8 h-8 text-white" />
            <SGsuiteWordmark className="text-2xl" />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              {t.nav.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          ← {t.nav.back}
        </Link>
        <h1 className="mt-6 font-brand text-4xl font-bold text-white tracking-tight">{doc.title}</h1>
        {doc.updated && (
          <p className="mt-3 text-sm text-slate-500">
            {t.updatedLabel}: {doc.updated}
          </p>
        )}
        <p className="mt-6 text-lg leading-relaxed text-slate-300">{doc.intro}</p>

        <div className="mt-12 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
              {section.body.map((block, i) => (
                <LegalBlockView key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
