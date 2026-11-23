import { defineMessages } from "../config";

export type MarketingIcon =
  | "chart"
  | "search"
  | "globe"
  | "layers"
  | "sparkles"
  | "users"
  | "shield"
  | "target"
  | "document"
  | "calendar"
  | "check"
  | "link"
  | "bolt"
  | "clipboard"
  | "history"
  | "plug";

interface FeatureItem {
  title: string;
  text: string;
}

interface FeatureGroup {
  id: string;
  icon: MarketingIcon;
  title: string;
  intro: string;
  items: FeatureItem[];
}

interface Benefit {
  icon: MarketingIcon;
  title: string;
  text: string;
}

interface Integration {
  name: string;
  category: string;
  text: string;
}

/** Texte der öffentlichen Marketing-Startseite */
export const marketingMessages = defineMessages({
  de: {
    meta: {
      title: "SGsuite – Search & Growth Suite",
      description:
        "SEO-Daten, Content-Prozesse und KI in einer Plattform: Google Search Console, Rank Tracking, Keyword Mapping, Briefings, Reporting und mehr.",
    },
    nav: {
      features: "Features",
      benefits: "Vorteile",
      integrations: "Schnittstellen",
      security: "Sicherheit",
      faq: "FAQ",
      login: "Anmelden",
    },
    hero: {
      eyebrow: "Search & Growth Suite",
      title: "SEO-Daten, Content-Prozesse und KI –",
      titleAccent: "in einer einzigen Suite.",
      text: "SGsuite verbindet Google Search Console, Rank Tracking, Keyword-Recherche, Content-Planung und Reporting. Vom ersten Insight bis zur umgesetzten Maßnahme – ohne Tool-Wechsel und ohne Excel-Chaos.",
      primaryCta: "Jetzt anmelden",
      secondaryCta: "Features entdecken",
      note: "Passwortloser Login per Magic Link · Zugang auf Einladung",
    },
    mockup: {
      clicks: "Klicks",
      impressions: "Impressionen",
      ctr: "CTR",
      position: "Ø Position",
      trend: "Sichtbarkeit · 28 Tage",
      tasks: "KVP-Aufgaben",
      aiSummary: "KI-Zusammenfassung",
      aiText: "Non-Brand-Klicks +18 % – Haupttreiber sind die Ratgeber-Seiten im DACH-Raum.",
    },
    stats: [
      { value: "25+", label: "Module & Werkzeuge" },
      { value: "10+", label: "angebundene APIs" },
      { value: "3", label: "KI-Modellfamilien" },
      { value: "∞", label: "Datenhistorie per Snapshot" },
    ],
    benefits: {
      eyebrow: "Vorteile",
      title: "Warum Teams auf SGsuite setzen",
      text: "SEO ist Teamarbeit über viele Datenquellen hinweg. SGsuite macht daraus einen wiederholbaren, messbaren Prozess.",
      items: [
        {
          icon: "layers",
          title: "Alles an einem Ort",
          text: "Search Console, Rankings, Backlinks, Keyword-Daten, Aufgaben und Reports in einer Oberfläche – kein Hin- und Herspringen zwischen fünf Tools.",
        },
        {
          icon: "history",
          title: "Historie über 16 Monate hinaus",
          text: "Snapshots frieren GSC-Daten ein. So sind Vorher/Nachher-Vergleiche nach Relaunches oder Google-Updates jederzeit möglich.",
        },
        {
          icon: "target",
          title: "Prozess statt Bauchgefühl",
          text: "KVP, Reifegrad, Briefings und Redaktionsplan machen SEO strukturiert, nachvollziehbar und messbar.",
        },
        {
          icon: "sparkles",
          title: "KI, die Arbeit abnimmt",
          text: "Briefing-Vorschläge, FAQ- und Title-Generator, Journey-Klassifikation und Executive Summaries sparen Stunden pro Woche.",
        },
        {
          icon: "users",
          title: "Zusammenarbeit mit Agenturen",
          text: "Rollen und Zuständigkeiten sorgen dafür, dass internes Team und externe Partner sicher im selben System arbeiten.",
        },
        {
          icon: "globe",
          title: "International & GEO-fähig",
          text: "Länder-Analysen, Hreflang-Checks und mehrsprachige Oberfläche (DE/EN) für Märkte und Regionen.",
        },
      ] satisfies Benefit[],
    },
    features: {
      eyebrow: "Features",
      title: "Ein Funktionsumfang für den gesamten SEO-Zyklus",
      text: "Von der Analyse über die Planung bis zur Umsetzung und zum Reporting – jedes Modul greift auf dieselben Daten zu.",
      groups: [
        {
          id: "analyse",
          icon: "chart",
          title: "Analyse & Monitoring",
          intro: "Verstehen, was passiert – und warum.",
          items: [
            { title: "Haupt-Dashboard", text: "Klicks, Impressionen, CTR und Position als Zeitreihe plus interne KPIs wie KVP-Status und Reifegrad." },
            { title: "GSC-Tiefenanalyse", text: "Auswertung nach Verzeichnissen, Suchanfragen, Seiten, Ländern und Geräten – mit Brand-/Non-Brand-Filter." },
            { title: "Snapshots & Vergleich", text: "Zwei Zeitpunkte auf Keyword- und Verzeichnisebene gegenüberstellen und exportieren." },
            { title: "Rank Tracker", text: "Tägliches Ranking-Monitoring definierter Keywords inklusive Suchvolumen und Historie." },
            { title: "Linkprofil", text: "Backlink-Analyse mit Anzahl, Qualität und Herkunft der verlinkenden Domains." },
            { title: "Technisches SEO", text: "Health-Score, Indexierbarkeit, Sitemap-Abdeckung und verwaiste Seiten aus dem Website-Monitoring." },
          ],
        },
        {
          id: "planung",
          icon: "search",
          title: "Recherche & Planung",
          intro: "Die richtigen Themen zur richtigen Zeit.",
          items: [
            { title: "Themen- & Keyword-Planung", text: "Topics, Nutzerfragen, Keyword-Sets und Google-Trends-Verläufe für die Marketingplanung." },
            { title: "Keyword Mapping", text: "Saubere Zuordnung von Keywords zu URLs inklusive Overlap-Analyse gegen Kannibalisierung." },
            { title: "Topic-Gap-Analyse", text: "Findet fehlende Unterthemen pro URL und erzeugt daraus direkt Aufgaben oder Redaktionsplan-Einträge." },
            { title: "Customer Journey", text: "KI-gestützte Zuordnung von Content zu Journey-Phasen – Lücken im Funnel werden sichtbar." },
            { title: "Suchintention & Volumen", text: "Intent-Klassifikation, Suchvolumen, CPC und Keyword-Difficulty per Massenabfrage." },
          ],
        },
        {
          id: "content",
          icon: "document",
          title: "Content & Optimierung",
          intro: "Von der Idee zum optimierten Inhalt.",
          items: [
            { title: "SEO-KVP", text: "Kontinuierlicher Verbesserungsprozess pro URL mit Fokus- und Subkeywords, Kommentaren und Anhängen." },
            { title: "Briefing-System", text: "Standardisierte Content-Briefings mit KI-Vorschlägen und automatisch generierten Diagrammen." },
            { title: "Redaktionsplan", text: "Zentrale Content-Planung mit Status, Kategorien und Verknüpfung zu Keywords und Journey." },
            { title: "Content-Check & Reviews", text: "Freigabe-Workflows mit Rollen, Fristen und Überarbeitungsschleifen." },
            { title: "Content Mapping", text: "Semantische Analyse bestehender Inhalte per Embeddings – findet Überschneidungen und Lücken." },
            { title: "URL-Checker", text: "Über 100 Prüfpunkte zu Technik, Content-Qualität, E-E-A-T, Hreflang und PageSpeed in einem Score." },
          ],
        },
        {
          id: "steuerung",
          icon: "clipboard",
          title: "Steuerung & Reporting",
          intro: "Ergebnisse sichtbar machen und Arbeit organisieren.",
          items: [
            { title: "Reporting-Hub", text: "Ranking-, Traffic-, KVP- und Task-Reports plus KI-generierte Executive Summary fürs Management." },
            { title: "SEO-Reifegrad", text: "Checklisten-basierte Bewertung nach Kategorien und Teams, mit Verlauf und Vergleich." },
            { title: "Aufgaben & Tickets", text: "Kanban-Board mit Drag & Drop direkt neben den Daten sowie Ticket-System für Bugs und Wünsche." },
            { title: "URL-Cleanup", text: "URL-Inventar, Bewertungsdimensionen und Zuständigkeiten für strukturierte Aufräumprojekte." },
          ],
        },
        {
          id: "ki",
          icon: "sparkles",
          title: "KI-Werkzeuge",
          intro: "Ein SEO-Assistent, der nie Feierabend macht.",
          items: [
            { title: "Superagent", text: "Integrierter KI-Chat für schnelle SEO-Einschätzungen und Empfehlungen im Kontext." },
            { title: "SERP-Benchmarker", text: "Analysiert die Top-Ergebnisse zu einem Keyword und zeigt, was sie auszeichnet." },
            { title: "FAQ-, Title- & Schema-Generator", text: "Erzeugt FAQs, klickstarke Titles und JSON-LD Structured Data für Rich Results." },
            { title: "Content Analyzer & AI Summarizer", text: "Bewertet Inhalte nach SEO-Kriterien und fasst beliebige URLs zusammen." },
            { title: "Keyword Clustering & SERP Preview", text: "Gruppiert Keywords thematisch und zeigt Snippets vor der Veröffentlichung." },
          ],
        },
      ] satisfies FeatureGroup[],
    },
    steps: {
      eyebrow: "So funktioniert's",
      title: "In drei Schritten zu besseren Rankings",
      items: [
        { title: "Verbinden", text: "Google-Konto verknüpfen, Search-Console-Properties auswählen – die Daten stehen sofort bereit." },
        { title: "Analysieren", text: "Dashboards, Vergleiche und KI-Analysen zeigen Potenziale, Risiken und Prioritäten." },
        { title: "Umsetzen & berichten", text: "Maßnahmen als KVP, Briefing oder Aufgabe planen und den Erfolg automatisch reporten." },
      ],
    },
    integrations: {
      eyebrow: "Schnittstellen & APIs",
      title: "Angebunden an die Datenquellen, die zählen",
      text: "SGsuite bündelt etablierte SEO- und KI-APIs hinter einer Oberfläche. Ihr braucht keine eigenen Accounts, Skripte oder Exporte.",
      items: [
        { name: "Google Search Console API", category: "Google", text: "Klicks, Impressionen, CTR und Positionen nach Query, Seite, Land und Gerät." },
        { name: "Google PageSpeed Insights", category: "Google", text: "Core Web Vitals und Performance-Scores für Mobile und Desktop." },
        { name: "Google OAuth", category: "Google", text: "Sichere Verknüpfung des Google-Kontos für den Search-Console-Zugriff." },
        { name: "DataForSEO", category: "SEO-Daten", text: "Rankings, SERP-Analysen, Suchvolumen, Backlinks und Google-Trends-Daten." },
        { name: "SEOspark", category: "SEO-Daten", text: "Keyword-Metriken, Difficulty, Suchintention und SERP-Features." },
        { name: "Topicloops", category: "SEO-Daten", text: "Topic-Graphen als Grundlage für Themencluster und Topic-Gap-Analysen." },
        { name: "Conductor Monitoring", category: "Technisches SEO", text: "Kontinuierliches Website-Monitoring mit Issues, Health-Score und Indexierbarkeit." },
        { name: "OpenAI", category: "KI", text: "GPT-Modelle für Textaufgaben und Embeddings für semantische Content-Analysen." },
        { name: "Anthropic Claude", category: "KI", text: "Tiefe Analysen, Briefing-Vorschläge, Reports und der Superagent." },
        { name: "Google Gemini", category: "KI", text: "Schnelle Klassifikation und Bildgenerierung für Briefing-Diagramme." },
      ] satisfies Integration[],
    },
    security: {
      eyebrow: "Sicherheit",
      title: "Enterprise-tauglich von Anfang an",
      text: "SGsuite verarbeitet sensible Performance-Daten. Deshalb ist Sicherheit kein Add-on, sondern Grundprinzip.",
      items: [
        { icon: "bolt", title: "Passwortloser Login", text: "Anmeldung per Magic Link – keine Passwörter, die geleakt oder wiederverwendet werden können." },
        { icon: "users", title: "Rollenbasierte Rechte", text: "Feingranulare Rollen von Superadmin über Agentur bis Viewer – jeder sieht nur, was er braucht." },
        { icon: "shield", title: "Gehärtete Plattform", text: "HSTS, strikte Security-Header, Rate Limiting und HTML-Sanitizing schützen vor gängigen Angriffen." },
        { icon: "check", title: "Zugang nur auf Einladung", text: "Neue Nutzer werden gezielt eingeladen – keine offene Registrierung." },
      ] satisfies Benefit[],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      items: [
        { q: "Für wen ist SGsuite gedacht?", a: "Für SEO-, Content- und Marketing-Teams sowie deren Agenturen, die Daten, Planung und Umsetzung in einem Werkzeug bündeln wollen." },
        { q: "Welche Daten brauche ich zum Start?", a: "Einen Google-Account mit Zugriff auf die Search Console. Alle weiteren Datenquellen sind bereits zentral angebunden." },
        { q: "Ersetzt SGsuite die Google Search Console?", a: "Nein, SGsuite baut darauf auf: Es ergänzt die GSC-Daten um Historie, Rankings, Backlinks, KI-Analysen und Workflows." },
        { q: "Welche KI-Modelle kommen zum Einsatz?", a: "Je nach Aufgabe Modelle von OpenAI, Anthropic (Claude) und Google (Gemini) – jeweils das passende Modell für Text, Analyse oder Bild." },
        { q: "Wie bekomme ich Zugang?", a: "Der Zugang erfolgt per Einladung. Bereits eingeladene Nutzer melden sich mit ihrer E-Mail-Adresse per Magic Link an." },
      ],
    },
    cta: {
      title: "Bereit für SEO ohne Tool-Chaos?",
      text: "Melde Dich mit Deiner E-Mail-Adresse an und leg direkt los.",
      button: "Zum Login",
    },
    footer: {
      tagline: "Search & Growth Suite",
      rights: "Alle Rechte vorbehalten.",
      login: "Anmelden",
    },
  },
  en: {
    meta: {
      title: "SGsuite – Search & Growth Suite",
      description:
        "SEO data, content processes and AI in one platform: Google Search Console, rank tracking, keyword mapping, briefings, reporting and more.",
    },
    nav: {
      features: "Features",
      benefits: "Benefits",
      integrations: "Integrations",
      security: "Security",
      faq: "FAQ",
      login: "Sign in",
    },
    hero: {
      eyebrow: "Search & Growth Suite",
      title: "SEO data, content processes and AI –",
      titleAccent: "in one single suite.",
      text: "SGsuite connects Google Search Console, rank tracking, keyword research, content planning and reporting. From the first insight to the finished task – without switching tools or juggling spreadsheets.",
      primaryCta: "Sign in now",
      secondaryCta: "Explore features",
      note: "Passwordless sign-in via magic link · Access by invitation",
    },
    mockup: {
      clicks: "Clicks",
      impressions: "Impressions",
      ctr: "CTR",
      position: "Avg. position",
      trend: "Visibility · 28 days",
      tasks: "CIP tasks",
      aiSummary: "AI summary",
      aiText: "Non-brand clicks +18% – mainly driven by the guide pages in the DACH region.",
    },
    stats: [
      { value: "25+", label: "Modules & tools" },
      { value: "10+", label: "Connected APIs" },
      { value: "3", label: "AI model families" },
      { value: "∞", label: "Data history via snapshots" },
    ],
    benefits: {
      eyebrow: "Benefits",
      title: "Why teams choose SGsuite",
      text: "SEO is teamwork across many data sources. SGsuite turns it into a repeatable, measurable process.",
      items: [
        {
          icon: "layers",
          title: "Everything in one place",
          text: "Search Console, rankings, backlinks, keyword data, tasks and reports in one interface – no jumping between five tools.",
        },
        {
          icon: "history",
          title: "History beyond 16 months",
          text: "Snapshots freeze GSC data, so before/after comparisons after relaunches or Google updates are always possible.",
        },
        {
          icon: "target",
          title: "Process over gut feeling",
          text: "Continuous improvement, maturity model, briefings and editorial plan make SEO structured, traceable and measurable.",
        },
        {
          icon: "sparkles",
          title: "AI that does the work",
          text: "Briefing suggestions, FAQ and title generators, journey classification and executive summaries save hours every week.",
        },
        {
          icon: "users",
          title: "Collaboration with agencies",
          text: "Roles and responsibilities let internal teams and external partners work safely in the same system.",
        },
        {
          icon: "globe",
          title: "International & GEO-ready",
          text: "Country analyses, hreflang checks and a bilingual interface (DE/EN) for markets and regions.",
        },
      ] satisfies Benefit[],
    },
    features: {
      eyebrow: "Features",
      title: "Features for the entire SEO cycle",
      text: "From analysis and planning to execution and reporting – every module works on the same data.",
      groups: [
        {
          id: "analyse",
          icon: "chart",
          title: "Analysis & monitoring",
          intro: "Understand what is happening – and why.",
          items: [
            { title: "Main dashboard", text: "Clicks, impressions, CTR and position over time plus internal KPIs such as CIP status and maturity." },
            { title: "GSC deep dive", text: "Analysis by directory, query, page, country and device – with brand/non-brand filter." },
            { title: "Snapshots & comparison", text: "Compare two points in time at keyword and directory level and export the results." },
            { title: "Rank tracker", text: "Daily ranking monitoring of defined keywords including search volume and history." },
            { title: "Link profile", text: "Backlink analysis covering number, quality and origin of referring domains." },
            { title: "Technical SEO", text: "Health score, indexability, sitemap coverage and orphan pages from website monitoring." },
          ],
        },
        {
          id: "planung",
          icon: "search",
          title: "Research & planning",
          intro: "The right topics at the right time.",
          items: [
            { title: "Topic & keyword planning", text: "Topics, user questions, keyword sets and Google Trends curves for marketing planning." },
            { title: "Keyword mapping", text: "Clean keyword-to-URL assignment including overlap analysis against cannibalisation." },
            { title: "Topic gap analysis", text: "Finds missing subtopics per URL and turns them directly into tasks or editorial plan entries." },
            { title: "Customer journey", text: "AI-assisted mapping of content to journey stages – funnel gaps become visible." },
            { title: "Search intent & volume", text: "Intent classification, search volume, CPC and keyword difficulty in bulk." },
          ],
        },
        {
          id: "content",
          icon: "document",
          title: "Content & optimisation",
          intro: "From idea to optimised content.",
          items: [
            { title: "SEO CIP", text: "Continuous improvement process per URL with focus and sub-keywords, comments and attachments." },
            { title: "Briefing system", text: "Standardised content briefings with AI suggestions and automatically generated diagrams." },
            { title: "Editorial plan", text: "Central content planning with status, categories and links to keywords and journey." },
            { title: "Content check & reviews", text: "Approval workflows with roles, deadlines and revision loops." },
            { title: "Content mapping", text: "Semantic analysis of existing content via embeddings – finds overlaps and gaps." },
            { title: "URL checker", text: "100+ checks on technology, content quality, E-E-A-T, hreflang and PageSpeed in one score." },
          ],
        },
        {
          id: "steuerung",
          icon: "clipboard",
          title: "Management & reporting",
          intro: "Make results visible and organise the work.",
          items: [
            { title: "Reporting hub", text: "Ranking, traffic, CIP and task reports plus an AI-generated executive summary for management." },
            { title: "SEO maturity", text: "Checklist-based assessment by category and team, with history and comparison." },
            { title: "Tasks & tickets", text: "Drag-and-drop Kanban board right next to the data, plus a ticket system for bugs and requests." },
            { title: "URL cleanup", text: "URL inventory, assessment dimensions and ownership for structured cleanup projects." },
          ],
        },
        {
          id: "ki",
          icon: "sparkles",
          title: "AI tools",
          intro: "An SEO assistant that never clocks off.",
          items: [
            { title: "Superagent", text: "Built-in AI chat for quick SEO assessments and recommendations in context." },
            { title: "SERP benchmarker", text: "Analyses the top results for a keyword and shows what sets them apart." },
            { title: "FAQ, title & schema generator", text: "Generates FAQs, compelling titles and JSON-LD structured data for rich results." },
            { title: "Content analyzer & AI summarizer", text: "Scores content against SEO criteria and summarises any URL." },
            { title: "Keyword clustering & SERP preview", text: "Groups keywords by topic and previews snippets before publishing." },
          ],
        },
      ] satisfies FeatureGroup[],
    },
    steps: {
      eyebrow: "How it works",
      title: "Three steps to better rankings",
      items: [
        { title: "Connect", text: "Link your Google account and select Search Console properties – the data is available immediately." },
        { title: "Analyse", text: "Dashboards, comparisons and AI analyses reveal opportunities, risks and priorities." },
        { title: "Act & report", text: "Plan measures as CIP items, briefings or tasks and report on success automatically." },
      ],
    },
    integrations: {
      eyebrow: "Integrations & APIs",
      title: "Connected to the data sources that matter",
      text: "SGsuite bundles established SEO and AI APIs behind one interface. No separate accounts, scripts or exports required.",
      items: [
        { name: "Google Search Console API", category: "Google", text: "Clicks, impressions, CTR and positions by query, page, country and device." },
        { name: "Google PageSpeed Insights", category: "Google", text: "Core Web Vitals and performance scores for mobile and desktop." },
        { name: "Google OAuth", category: "Google", text: "Secure Google account linking for Search Console access." },
        { name: "DataForSEO", category: "SEO data", text: "Rankings, SERP analyses, search volume, backlinks and Google Trends data." },
        { name: "SEOspark", category: "SEO data", text: "Keyword metrics, difficulty, search intent and SERP features." },
        { name: "Topicloops", category: "SEO data", text: "Topic graphs as the basis for topic clusters and gap analyses." },
        { name: "Conductor Monitoring", category: "Technical SEO", text: "Continuous website monitoring with issues, health score and indexability." },
        { name: "OpenAI", category: "AI", text: "GPT models for text tasks and embeddings for semantic content analysis." },
        { name: "Anthropic Claude", category: "AI", text: "In-depth analyses, briefing suggestions, reports and the Superagent." },
        { name: "Google Gemini", category: "AI", text: "Fast classification and image generation for briefing diagrams." },
      ] satisfies Integration[],
    },
    security: {
      eyebrow: "Security",
      title: "Enterprise-ready from day one",
      text: "SGsuite processes sensitive performance data. That is why security is a core principle, not an add-on.",
      items: [
        { icon: "bolt", title: "Passwordless sign-in", text: "Sign in via magic link – no passwords that can be leaked or reused." },
        { icon: "users", title: "Role-based permissions", text: "Fine-grained roles from superadmin to agency to viewer – everyone sees only what they need." },
        { icon: "shield", title: "Hardened platform", text: "HSTS, strict security headers, rate limiting and HTML sanitising protect against common attacks." },
        { icon: "check", title: "Invitation-only access", text: "New users are invited deliberately – there is no open registration." },
      ] satisfies Benefit[],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      items: [
        { q: "Who is SGsuite for?", a: "For SEO, content and marketing teams and their agencies who want data, planning and execution in one tool." },
        { q: "What do I need to get started?", a: "A Google account with Search Console access. All other data sources are already connected centrally." },
        { q: "Does SGsuite replace Google Search Console?", a: "No, SGsuite builds on it: it adds history, rankings, backlinks, AI analyses and workflows to your GSC data." },
        { q: "Which AI models are used?", a: "Depending on the task, models from OpenAI, Anthropic (Claude) and Google (Gemini) – the right model for text, analysis or images." },
        { q: "How do I get access?", a: "Access is by invitation. Invited users sign in with their email address via magic link." },
      ],
    },
    cta: {
      title: "Ready for SEO without tool chaos?",
      text: "Sign in with your email address and get started right away.",
      button: "Go to sign-in",
    },
    footer: {
      tagline: "Search & Growth Suite",
      rights: "All rights reserved.",
      login: "Sign in",
    },
  },
});
