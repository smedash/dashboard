import Image from "next/image";
import Link from "next/link";
import { getMessages } from "@/i18n/server";
import { marketingMessages } from "@/i18n/messages/marketing";
import { SGsuiteMark, SGsuiteWordmark } from "@/components/ui/SGsuiteLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MarketingIcon } from "./MarketingIcon";
import { MarketingFooter } from "./MarketingFooter";

type Messages = (typeof marketingMessages)["de"];

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400 mb-3">{eyebrow}</p>
      <h2 className="font-brand text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h2>
      {text && <p className="mt-4 text-lg text-slate-400">{text}</p>}
    </div>
  );
}

function DashboardMockup({ t }: { t: Messages["mockup"] }) {
  const kpis = [
    { label: t.clicks, value: "48.2K", delta: "+12.4%" },
    { label: t.impressions, value: "1.9M", delta: "+8.1%" },
    { label: t.ctr, value: "2.5%", delta: "+0.3" },
    { label: t.position, value: "8.4", delta: "-1.2" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-blue-600/20 blur-3xl rounded-full" aria-hidden="true" />
      <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-xl shadow-2xl p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-slate-800/70 border border-slate-700/50 p-3">
              <p className="text-[11px] text-slate-400">{kpi.label}</p>
              <p className="text-lg font-semibold text-white">{kpi.value}</p>
              <p className="text-[11px] font-medium text-emerald-400">{kpi.delta}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-slate-800/70 border border-slate-700/50 p-4">
          <p className="text-xs text-slate-400 mb-2">{t.trend}</p>
          <svg viewBox="0 0 300 90" className="w-full h-24" aria-hidden="true">
            <defs>
              <linearGradient id="mk-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 70 L25 64 L50 68 L75 55 L100 58 L125 46 L150 50 L175 38 L200 42 L225 28 L250 30 L275 18 L300 12 L300 90 L0 90 Z"
              fill="url(#mk-area)"
            />
            <path
              d="M0 70 L25 64 L50 68 L75 55 L100 58 L125 46 L150 50 L175 38 L200 42 L225 28 L250 30 L275 18 L300 12"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800/70 border border-slate-700/50 p-4">
            <p className="text-xs text-slate-400 mb-3">{t.tasks}</p>
            <div className="space-y-2">
              {[80, 55, 30].map((w, i) => (
                <div key={w} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${i === 0 ? "bg-emerald-400" : i === 1 ? "bg-blue-400" : "bg-slate-500"}`} />
                  <span className="h-2 rounded-full bg-slate-700" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/10 border border-blue-500/30 p-4">
            <p className="flex items-center gap-1.5 text-xs text-blue-300 mb-2">
              <MarketingIcon name="sparkles" className="w-3.5 h-3.5" />
              {t.aiSummary}
            </p>
            <p className="text-xs leading-relaxed text-slate-200">{t.aiText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function MarketingHome() {
  const t = await getMessages(marketingMessages);
  const navLinks = [
    { href: "#vorteile", label: t.nav.benefits },
    { href: "#features", label: t.nav.features },
    { href: "#schnittstellen", label: t.nav.integrations },
    { href: "#sicherheit", label: t.nav.security },
    { href: "#faq", label: t.nav.faq },
  ];
  const integrationCategories = [...new Set(t.integrations.items.map((i) => i.category))];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="SGsuite">
            <SGsuiteMark className="w-8 h-8 text-white" />
            <SGsuiteWordmark className="text-2xl" />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-slate-400 hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
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

      <main>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_60%)]"
            aria-hidden="true"
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-28 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                <MarketingIcon name="bolt" className="w-3.5 h-3.5" />
                {t.hero.eyebrow}
              </p>
              <h1 className="mt-6 font-brand text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
                {t.hero.title}{" "}
                <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                  {t.hero.titleAccent}
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-400 max-w-xl">{t.hero.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="px-6 py-3 font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  {t.hero.primaryCta}
                </Link>
                <a
                  href="#features"
                  className="px-6 py-3 font-semibold text-white border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  {t.hero.secondaryCta}
                </a>
                <Image
                  src="/gdpr-ssl-secure-site.webp"
                  alt={t.hero.trustBadgeAlt}
                  width={84}
                  height={48}
                  className="h-12 w-auto self-center brightness-0 invert opacity-80"
                />
              </div>
              <p className="mt-5 text-sm text-slate-500">{t.hero.note}</p>
            </div>
            <DashboardMockup t={t.mockup} />
          </div>
        </section>

        <section className="border-y border-slate-800/80 bg-slate-900/40">
          <dl className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {t.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-brand text-4xl font-bold text-white">{stat.value}</dd>
                <dd className="mt-1 text-sm text-slate-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="vorteile" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <SectionHeading eyebrow={t.benefits.eyebrow} title={t.benefits.title} text={t.benefits.text} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.benefits.items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-blue-500/40 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-5">
                  <MarketingIcon name={item.icon} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-slate-400 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-slate-900/40 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
            <SectionHeading eyebrow={t.features.eyebrow} title={t.features.title} text={t.features.text} />
            <div className="space-y-8">
              {t.features.groups.map((group) => (
                <div
                  key={group.id}
                  className="grid lg:grid-cols-[280px_1fr] gap-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8"
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white flex items-center justify-center mb-4">
                      <MarketingIcon name={group.icon} className="w-6 h-6" />
                    </div>
                    <h3 className="font-brand text-2xl font-bold text-white">{group.title}</h3>
                    <p className="mt-2 text-slate-400">{group.intro}</p>
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                    {group.items.map((item) => (
                      <li key={item.title} className="flex gap-3">
                        <MarketingIcon name="check" className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />
                        <div>
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-400 leading-relaxed">{item.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <SectionHeading eyebrow={t.steps.eyebrow} title={t.steps.title} />
          <ol className="grid md:grid-cols-3 gap-6">
            {t.steps.items.map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <span className="font-brand text-5xl font-bold text-blue-500/30">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-slate-400 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="schnittstellen" className="scroll-mt-20 bg-slate-900/40 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
            <SectionHeading eyebrow={t.integrations.eyebrow} title={t.integrations.title} text={t.integrations.text} />
            <div className="space-y-10">
              {integrationCategories.map((category) => (
                <div key={category}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500 mb-4">
                    <MarketingIcon name="plug" className="w-4 h-4" />
                    {category}
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {t.integrations.items
                      .filter((item) => item.category === category)
                      .map((item) => (
                        <div key={item.name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{item.text}</p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sicherheit" className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <SectionHeading eyebrow={t.security.eyebrow} title={t.security.title} text={t.security.text} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.security.items.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-5">
                  <MarketingIcon name={item.icon} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-slate-400 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 bg-slate-900/40 border-y border-slate-800/80">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} />
            <div className="space-y-3">
              {t.faq.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-4 open:border-blue-500/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
                    {item.q}
                    <span className="text-slate-500 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-slate-400 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-600/25 via-slate-900 to-emerald-600/10 px-6 py-16 text-center">
            <h2 className="font-brand text-3xl sm:text-4xl font-bold text-white tracking-tight">{t.cta.title}</h2>
            <p className="mt-4 text-lg text-slate-300">{t.cta.text}</p>
            <Link
              href="/login"
              className="mt-8 inline-block px-8 py-3.5 font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              {t.cta.button}
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
