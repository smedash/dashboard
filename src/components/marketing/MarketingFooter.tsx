import Link from "next/link";
import { getMessages } from "@/i18n/server";
import { marketingMessages } from "@/i18n/messages/marketing";
import { SGsuiteMark, SGsuiteWordmark } from "@/components/ui/SGsuiteLogo";

export async function MarketingFooter() {
  const t = (await getMessages(marketingMessages)).footer;
  const links = [
    { href: "/impressum", label: t.imprint },
    { href: "/datenschutz", label: t.privacy },
    { href: "/agb", label: t.terms },
    { href: "/login", label: t.login },
  ];

  return (
    <footer className="border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col lg:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2.5 text-white">
          <SGsuiteMark className="w-6 h-6 text-white" />
          <SGsuiteWordmark className="text-lg" />
          <span className="text-slate-500">· {t.tagline}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <span>
            © {new Date().getFullYear()} SGsuite. {t.rights}
          </span>
          <nav aria-label={t.legalNav} className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
