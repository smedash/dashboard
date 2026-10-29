import { defineMessages } from "../config";

export type DocSectionId =
  | "erste-schritte"
  | "dashboard"
  | "auswertung"
  | "ranktracker"
  | "linkprofil"
  | "seo-kvp"
  | "seo-reifegrad"
  | "briefings"
  | "tasks"
  | "reporting"
  | "superagent"
  | "seo-helper"
  | "einstellungen";

export interface DocArticleText {
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

export interface DocSectionText {
  title: string;
  description: string;
  articles: DocArticleText[];
}

export const documentationMessages = defineMessages({
  de: {
    title: "Dokumentation",
    intro:
      "Willkommen in der Dokumentation des SME Dashboards. Hier findest du alle Informationen zu den Funktionen und Features.",
    searchPlaceholder: "Dokumentation durchsuchen...",
    clearSearch: "Suche zurücksetzen",
    noResults: "Keine Ergebnisse gefunden",
    resultsFound: (n: number) => `${n} Abschnitt${n !== 1 ? "e" : ""} mit Hinweisen gefunden`,
    quickStart: {
      title: "Schnellstart",
      intro: "Neu hier? Starte mit diesen drei Schritten, um das Dashboard einzurichten:",
      steps: ["Google Account verknüpfen", "Property auswählen", "Dashboard erkunden"],
    },
    stats: {
      categories: "Kategorien",
      articles: "Hinweise",
      seoTools: "SEO Tools",
      reportTypes: "Report-Typen",
    },
    tableOfContents: "Inhaltsverzeichnis",
    articleCount: (n: number) => `${n} Hinweise`,
    learnMore: "Mehr erfahren",
    help: {
      title: "Noch Fragen?",
      body: "Falls du weitere Hilfe benötigst oder einen Fehler melden möchtest, nutze die Tickets-Funktion.",
      createTicket: "Ticket erstellen",
    },
    sections: {
      "erste-schritte": {
        title: "Erste Schritte",
        description: "Schnellstart-Anleitung für neue Nutzer",
        articles: [
          {
            title: "Anmeldung & Google-Verknüpfung",
            body: "Nach der ersten Anmeldung im SME Dashboard musst du deinen Google Account verknüpfen, um auf die Google Search Console Daten zugreifen zu können. Klicke dazu auf den Button \"Connect with Google\" in der oberen Leiste oder gehe in die Einstellungen. Die Verknüpfung erlaubt dem Dashboard, deine GSC-Daten abzurufen und auszuwerten.",
            link: "/settings",
            linkLabel: "Zu den Einstellungen",
          },
          {
            title: "Property auswählen",
            body: "Oben links im Header findest du den Property Selector. Hier kannst du zwischen deinen verschiedenen Google Search Console Properties wechseln. Alle Daten im Dashboard beziehen sich immer auf die aktuell ausgewählte Property.",
          },
          {
            title: "Navigation verstehen",
            body: "Die linke Seitenleiste ist in mehrere Bereiche unterteilt: Daten (Auswertung, Ranktracker, Linkprofil), Prozesse (SEO KVP, SEO Reifegrad, Briefings), Aufgaben (Kanban Board), Reporting und KI & Tools (SuperAgent, SEO Helper). Jeder Bereich hat eigene Unterpunkte, die du durch Klicken auf die jeweilige Kategorie aufklappen kannst.",
          },
        ],
      },
      dashboard: {
        title: "Dashboard",
        description: "Überblick über alle wichtigen KPIs",
        articles: [
          {
            title: "KPI-Übersicht",
            body: "Das Dashboard zeigt dir die vier wichtigsten SEO-Kennzahlen auf einen Blick: Klicks, Impressionen, CTR (Click-Through-Rate) und die durchschnittliche Position. Jede Kennzahl zeigt auch die prozentuale Veränderung im Vergleich zum vorherigen Zeitraum.",
            link: "/",
            linkLabel: "Zum Dashboard",
          },
          {
            title: "Zeitraum wählen",
            body: "Mit dem Perioden-Selektor oben rechts kannst du den Auswertungszeitraum ändern: 7 Tage, 28 Tage, 3 Monate, 6 Monate oder 8 Monate. Die Vergleichswerte beziehen sich immer auf den gleich langen Zeitraum davor. Der maximale Zeitraum ist auf 8 Monate begrenzt, da die Google Search Console nur 16 Monate Daten bereitstellt und so ein vollständiger Vergleich mit dem vorherigen Zeitraum gewährleistet ist.",
          },
          {
            title: "Charts & Geräteverteilung",
            body: "Unterhalb der KPIs siehst du einen Linien-Chart für Klicks und Impressionen über die Zeit sowie ein Kreisdiagramm für die Geräteverteilung (Desktop, Mobile, Tablet). Im unteren Bereich findest du weitere Statistiken zu Benutzern, KVP-URLs, Reifegradmodellen, Briefings und Ranktracker-Keywords.",
          },
        ],
      },
      auswertung: {
        title: "Auswertung",
        description: "Detaillierte GSC-Datenanalyse",
        articles: [
          {
            title: "Übersicht",
            body: "Die Auswertungs-Übersicht zeigt dir eine Zusammenfassung deiner Google Search Console Daten. Du siehst die wichtigsten Metriken (Klicks, Impressionen, CTR, Position) und deren Entwicklung über den gewählten Zeitraum in übersichtlichen Charts.",
            link: "/auswertung",
            linkLabel: "Zur Auswertung",
          },
          {
            title: "Suchanfragen",
            body: "Unter Suchanfragen siehst du alle Keywords, für die deine Website in der Google-Suche erscheint. Die Tabelle zeigt Klicks, Impressionen, CTR und Position pro Keyword. Du kannst die Tabelle sortieren und nach bestimmten Keywords durchsuchen.",
            link: "/queries",
            linkLabel: "Zu Suchanfragen",
          },
          {
            title: "Seiten",
            body: "Die Seiten-Ansicht zeigt dir die Performance deiner einzelnen URLs. So erkennst du schnell, welche Seiten die meisten Klicks und Impressionen erhalten und wie sich deren Ranking entwickelt.",
            link: "/pages",
            linkLabel: "Zu Seiten",
          },
          {
            title: "Länder & Geräte",
            body: "Unter Länder siehst du, aus welchen Ländern deine Besucher kommen. Die Geräte-Ansicht zeigt die Verteilung zwischen Desktop, Mobile und Tablet. Beide Ansichten helfen dir, deine SEO-Strategie auf die wichtigsten Märkte und Gerätetypen auszurichten.",
            link: "/countries",
            linkLabel: "Zu Länder",
          },
        ],
      },
      ranktracker: {
        title: "Ranktracker",
        description: "Keyword-Rankings verfolgen und analysieren",
        articles: [
          {
            title: "Keywords tracken",
            body: "Der Ranktracker ermöglicht es dir, die Rankings bestimmter Keywords über die Zeit zu verfolgen. Du kannst Keywords hinzufügen, die für dein Unternehmen besonders relevant sind, und deren Positionsveränderungen in der Google-Suche beobachten.",
            link: "/ranktracker",
            linkLabel: "Zum Ranktracker",
          },
          {
            title: "Positionsverteilung",
            body: "Die Positionsverteilung zeigt dir, wie viele deiner Keywords in den Top 3, Top 10, Top 20, Top 50 oder darüber hinaus ranken. So behältst du den Überblick über die Gesamtperformance deiner SEO-Bemühungen.",
          },
        ],
      },
      linkprofil: {
        title: "Linkprofil",
        description: "Backlinks analysieren und überwachen",
        articles: [
          {
            title: "Backlink-Analyse",
            body: "Das Linkprofil zeigt dir alle eingehenden Links zu deiner Website, die von der Google Search Console erfasst werden. Du siehst, welche externen Seiten auf dich verlinken und welche deiner Seiten die meisten Backlinks erhalten.",
            link: "/linkprofil",
            linkLabel: "Zum Linkprofil",
          },
        ],
      },
      "seo-kvp": {
        title: "SEO KVP",
        description: "Kontinuierlicher Verbesserungsprozess für SEO",
        articles: [
          {
            title: "Was ist der SEO KVP?",
            body: "Der SEO KVP (Kontinuierlicher Verbesserungsprozess) hilft dir, systematisch an der SEO-Optimierung deiner Website zu arbeiten. Du kannst URLs hinterlegen, die regelmäßig überprüft und optimiert werden sollen. Dabei wird der Fortschritt dokumentiert und nachverfolgt.",
            link: "/ubs-kvp",
            linkLabel: "Zum SEO KVP",
          },
          {
            title: "URLs verwalten",
            body: "Im KVP kannst du URLs hinzufügen, bearbeiten und ihren Optimierungsstatus verfolgen. Jede URL wird mit relevanten SEO-Metriken verknüpft, sodass du die Auswirkungen deiner Optimierungen direkt sehen kannst.",
          },
        ],
      },
      "seo-reifegrad": {
        title: "SEO Reifegrad",
        description: "SEO-Reifegrad deiner Organisation bewerten",
        articles: [
          {
            title: "Reifegradmodelle",
            body: "Mit dem SEO-Reifegrad-Tool kannst du den aktuellen Stand der SEO-Reife deiner Organisation oder Abteilung bewerten. Du erstellst Modelle mit verschiedenen Checkpunkten und bewertest diese. So erkennst du Stärken und Verbesserungspotenziale.",
            link: "/seo-reifegrad",
            linkLabel: "Zum SEO Reifegrad",
          },
          {
            title: "Checkpunkte bewerten",
            body: "Jedes Reifegradmodell besteht aus mehreren Checkpunkten, die du auf einer Skala bewerten kannst. Die Ergebnisse werden visualisiert, sodass du auf einen Blick siehst, wo dein Unternehmen in Sachen SEO steht.",
          },
        ],
      },
      briefings: {
        title: "Briefings",
        description: "Content-Briefings erstellen und verwalten",
        articles: [
          {
            title: "Briefings erstellen",
            body: "Erstelle strukturierte Content-Briefings für Texter und Redakteure. Ein Briefing enthält alle relevanten Informationen wie Ziel-Keywords, Seitenstruktur, inhaltliche Anforderungen und SEO-Vorgaben.",
            link: "/briefings",
            linkLabel: "Zu Briefings",
          },
          {
            title: "Status-Management",
            body: "Jedes Briefing durchläuft verschiedene Status: Offen (erstellt, noch nicht bearbeitet), In Arbeit (wird gerade umgesetzt) und Abgeschlossen. So behältst du den Überblick über den Fortschritt aller Briefings.",
          },
          {
            title: "Briefing-Auswertung",
            body: "In der Auswertung siehst du Statistiken zu deinen Briefings: Wie viele sind offen, in Arbeit oder abgeschlossen? Welche Fortschritte wurden erzielt? Diese Übersicht hilft dir bei der Planung und Priorisierung.",
            link: "/briefings/auswertung",
            linkLabel: "Zur Briefing-Auswertung",
          },
        ],
      },
      tasks: {
        title: "Kanban Board",
        description: "Aufgaben visuell organisieren und verwalten",
        articles: [
          {
            title: "Aufgabenmanagement",
            body: "Das Kanban Board bietet dir eine visuelle Übersicht über alle SEO-Aufgaben. Du kannst Tasks erstellen, in Spalten organisieren (z.B. To-Do, In Arbeit, Erledigt) und per Drag & Drop verschieben. Ideal für die Zusammenarbeit im Team.",
            link: "/tasks",
            linkLabel: "Zum Kanban Board",
          },
          {
            title: "Tasks erstellen & bearbeiten",
            body: "Erstelle neue Tasks mit Titel, Beschreibung, Priorität und Deadline. Weise Tasks Teammitgliedern zu und verfolge den Fortschritt. Jeder Task kann kommentiert und mit zusätzlichen Details versehen werden.",
          },
        ],
      },
      reporting: {
        title: "Reporting",
        description: "Umfassende SEO-Reports generieren",
        articles: [
          {
            title: "Report-Übersicht",
            body: "Die Reporting-Übersicht bietet dir einen zentralen Zugang zu allen verfügbaren Report-Typen. Von hier aus kannst du verschiedene Reports erstellen, ansehen und exportieren.",
            link: "/reporting",
            linkLabel: "Zum Reporting",
          },
          {
            title: "Ranking Report",
            body: "Der Ranking Report zeigt dir detaillierte Informationen über die Ranking-Entwicklung deiner Keywords. Du siehst, welche Keywords gestiegen oder gefallen sind und kannst Trends über verschiedene Zeiträume analysieren.",
            link: "/reporting/ranking",
            linkLabel: "Zum Ranking Report",
          },
          {
            title: "Traffic Report",
            body: "Der Traffic Report analysiert den organischen Traffic deiner Website. Er zeigt dir Klicks, Impressionen und CTR-Entwicklung und hilft dir, den Erfolg deiner SEO-Maßnahmen zu messen.",
            link: "/reporting/traffic",
            linkLabel: "Zum Traffic Report",
          },
          {
            title: "KVP Report & Task Report",
            body: "Der KVP Report dokumentiert den Fortschritt deines kontinuierlichen Verbesserungsprozesses. Der Task Report gibt dir einen Überblick über alle erledigten und offenen Aufgaben im Reporting-Zeitraum.",
            link: "/reporting/kvp",
            linkLabel: "Zum KVP Report",
          },
        ],
      },
      superagent: {
        title: "SuperAgent",
        description: "KI-gestützter SEO-Assistent",
        articles: [
          {
            title: "Was ist der SuperAgent?",
            body: "Der SuperAgent ist ein KI-gestützter Assistent, der dir bei komplexen SEO-Aufgaben hilft. Du kannst ihm Fragen stellen, Analysen anfragen oder Aufgaben delegieren. Er nutzt die Daten aus deinem Dashboard, um kontextbezogene Empfehlungen zu geben.",
            link: "/superagent",
            linkLabel: "Zum SuperAgent",
          },
        ],
      },
      "seo-helper": {
        title: "SEO Helper",
        description: "Sammlung nützlicher SEO-Tools",
        articles: [
          {
            title: "Tool-Übersicht",
            body: "Der SEO Helper bietet dir eine Sammlung spezialisierter Tools für verschiedene SEO-Aufgaben. Alle Tools sind über die SEO Helper Hauptseite erreichbar.",
            link: "/seo-helper",
            linkLabel: "Zum SEO Helper",
          },
          {
            title: "AI Summarizer",
            body: "Der AI Summarizer fasst Texte und Webseiten automatisch zusammen. Ideal, um schnell den Inhalt von Wettbewerber-Seiten zu erfassen oder lange Texte auf die Kernaussagen zu reduzieren.",
            link: "/seo-helper/ai-summarizer",
            linkLabel: "Zum AI Summarizer",
          },
          {
            title: "Content Analyzer",
            body: "Analysiere die Qualität und SEO-Tauglichkeit deiner Inhalte. Der Content Analyzer bewertet Texte nach Kriterien wie Lesbarkeit, Keyword-Dichte, Struktur und gibt Verbesserungsvorschläge.",
            link: "/seo-helper/content-analyzer",
            linkLabel: "Zum Content Analyzer",
          },
          {
            title: "Keyword Clustering",
            body: "Gruppiere eine Liste von Keywords automatisch in thematische Cluster. So erkennst du, welche Keywords auf einer gemeinsamen Seite behandelt werden können und welche eigene Seiten benötigen.",
            link: "/seo-helper/keyword-clustering",
            linkLabel: "Zum Keyword Clustering",
          },
          {
            title: "Weitere Tools",
            body: "Der SEO Helper enthält außerdem: SERP Preview (Vorschau deiner Google-Suchergebnisse), Title Generator (KI-generierte Seitentitel), FAQ Generator (automatische FAQ-Erstellung), Schema Generator (strukturierte Daten für Google) und den Benchmarker (Wettbewerbsvergleich).",
            link: "/seo-helper",
            linkLabel: "Alle Tools anzeigen",
          },
        ],
      },
      einstellungen: {
        title: "Einstellungen & Verwaltung",
        description: "Account, Nutzer und Systemeinstellungen",
        articles: [
          {
            title: "Einstellungen",
            body: "In den Einstellungen kannst du dein Profil bearbeiten, deinen Google Account verknüpfen/trennen und weitere persönliche Einstellungen vornehmen.",
            link: "/settings",
            linkLabel: "Zu den Einstellungen",
          },
          {
            title: "Nutzerverwaltung (Admin)",
            body: "Administratoren und Agentur-Nutzer haben Zugriff auf die Nutzerverwaltung. Hier können neue Nutzer eingeladen, Rollen zugewiesen und bestehende Zugänge verwaltet werden.",
            link: "/admin/users",
            linkLabel: "Zur Nutzerverwaltung",
          },
          {
            title: "Bugs & Features",
            body: "Hast du einen Bug gefunden oder eine Idee für ein neues Feature? Über die Tickets-Funktion kannst du Fehler melden und Feature-Wünsche einreichen. Das Entwicklerteam wird benachrichtigt und arbeitet an der Umsetzung.",
            link: "/tickets",
            linkLabel: "Zu Bugs & Features",
          },
          {
            title: "Changelog",
            body: "Im Changelog findest du alle Änderungen und neuen Features, die am SME Dashboard vorgenommen wurden. So bleibst du immer auf dem neuesten Stand über Verbesserungen und neue Funktionen.",
            link: "/changelog",
            linkLabel: "Zum Changelog",
          },
        ],
      },
    } satisfies Record<DocSectionId, DocSectionText> as Record<DocSectionId, DocSectionText>,
  },
  en: {
    title: "Documentation",
    intro:
      "Welcome to the SME Dashboard documentation. Here you'll find everything you need to know about its functions and features.",
    searchPlaceholder: "Search documentation...",
    clearSearch: "Clear search",
    noResults: "No results found",
    resultsFound: (n: number) => `${n} ${n === 1 ? "section" : "sections"} with matching articles found`,
    quickStart: {
      title: "Quick start",
      intro: "New here? Start with these three steps to set up the dashboard:",
      steps: ["Connect your Google account", "Select a property", "Explore the dashboard"],
    },
    stats: {
      categories: "Categories",
      articles: "Articles",
      seoTools: "SEO tools",
      reportTypes: "Report types",
    },
    tableOfContents: "Table of contents",
    articleCount: (n: number) => `${n} ${n === 1 ? "article" : "articles"}`,
    learnMore: "Learn more",
    help: {
      title: "Any questions?",
      body: "If you need further help or want to report a bug, use the tickets feature.",
      createTicket: "Create ticket",
    },
    sections: {
      "erste-schritte": {
        title: "Getting started",
        description: "Quick-start guide for new users",
        articles: [
          {
            title: "Sign-in & Google connection",
            body: "After signing in to the SME Dashboard for the first time, you need to connect your Google account to access your Google Search Console data. To do so, click the \"Connect with Google\" button in the top bar or go to the settings. The connection allows the dashboard to fetch and analyse your GSC data.",
            link: "/settings",
            linkLabel: "Go to settings",
          },
          {
            title: "Select a property",
            body: "The property selector is in the top left of the header. Use it to switch between your Google Search Console properties. All data in the dashboard always refers to the currently selected property.",
          },
          {
            title: "Understanding the navigation",
            body: "The left sidebar is divided into several areas: Data (Analysis, Rank tracker, Link profile), Processes (SEO KVP, SEO maturity, Briefings), Tasks (Kanban board), Reporting, and AI & Tools (SuperAgent, SEO Helper). Each area has its own sub-items, which you can expand by clicking the respective category.",
          },
        ],
      },
      dashboard: {
        title: "Dashboard",
        description: "Overview of all key KPIs",
        articles: [
          {
            title: "KPI overview",
            body: "The dashboard shows you the four most important SEO metrics at a glance: clicks, impressions, CTR (click-through rate) and average position. Each metric also shows the percentage change compared with the previous period.",
            link: "/",
            linkLabel: "Go to dashboard",
          },
          {
            title: "Choosing a period",
            body: "Use the period selector in the top right to change the analysis period: 7 days, 28 days, 3 months, 6 months or 8 months. Comparison values always refer to the preceding period of the same length. The maximum period is limited to 8 months because Google Search Console only provides 16 months of data; this ensures a complete comparison with the previous period.",
          },
          {
            title: "Charts & device distribution",
            body: "Below the KPIs you'll find a line chart of clicks and impressions over time and a pie chart showing the device distribution (desktop, mobile, tablet). Further down are additional statistics on users, KVP URLs, maturity models, briefings and rank tracker keywords.",
          },
        ],
      },
      auswertung: {
        title: "Analysis",
        description: "Detailed GSC data analysis",
        articles: [
          {
            title: "Overview",
            body: "The analysis overview gives you a summary of your Google Search Console data. You can see the key metrics (clicks, impressions, CTR, position) and how they developed over the selected period in clear charts.",
            link: "/auswertung",
            linkLabel: "Go to analysis",
          },
          {
            title: "Queries",
            body: "Under Queries you'll see all keywords for which your website appears in Google Search. The table shows clicks, impressions, CTR and position per keyword. You can sort the table and search for specific keywords.",
            link: "/queries",
            linkLabel: "Go to queries",
          },
          {
            title: "Pages",
            body: "The Pages view shows the performance of your individual URLs. This lets you quickly see which pages get the most clicks and impressions and how their rankings are developing.",
            link: "/pages",
            linkLabel: "Go to pages",
          },
          {
            title: "Countries & devices",
            body: "Under Countries you can see which countries your visitors come from. The Devices view shows the split between desktop, mobile and tablet. Both views help you align your SEO strategy with your most important markets and device types.",
            link: "/countries",
            linkLabel: "Go to countries",
          },
        ],
      },
      ranktracker: {
        title: "Rank tracker",
        description: "Track and analyse keyword rankings",
        articles: [
          {
            title: "Tracking keywords",
            body: "The rank tracker lets you follow the rankings of specific keywords over time. You can add keywords that are particularly relevant to your business and monitor how their positions change in Google Search.",
            link: "/ranktracker",
            linkLabel: "Go to rank tracker",
          },
          {
            title: "Position distribution",
            body: "The position distribution shows how many of your keywords rank in the top 3, top 10, top 20, top 50 or beyond. This helps you keep track of the overall performance of your SEO efforts.",
          },
        ],
      },
      linkprofil: {
        title: "Link profile",
        description: "Analyse and monitor backlinks",
        articles: [
          {
            title: "Backlink analysis",
            body: "The link profile shows all incoming links to your website that Google Search Console has recorded. You can see which external sites link to you and which of your pages receive the most backlinks.",
            link: "/linkprofil",
            linkLabel: "Go to link profile",
          },
        ],
      },
      "seo-kvp": {
        title: "SEO KVP",
        description: "Continuous improvement process for SEO",
        articles: [
          {
            title: "What is the SEO KVP?",
            body: "The SEO KVP (continuous improvement process) helps you work on your website's SEO optimisation systematically. You can add URLs that should be reviewed and optimised regularly, and progress is documented and tracked along the way.",
            link: "/ubs-kvp",
            linkLabel: "Go to SEO KVP",
          },
          {
            title: "Managing URLs",
            body: "In the KVP you can add and edit URLs and track their optimisation status. Each URL is linked to relevant SEO metrics, so you can see the impact of your optimisations directly.",
          },
        ],
      },
      "seo-reifegrad": {
        title: "SEO maturity",
        description: "Assess your organisation's SEO maturity",
        articles: [
          {
            title: "Maturity models",
            body: "The SEO maturity tool lets you assess the current SEO maturity of your organisation or department. You create models with various checkpoints and rate them. This shows you strengths and areas for improvement.",
            link: "/seo-reifegrad",
            linkLabel: "Go to SEO maturity",
          },
          {
            title: "Rating checkpoints",
            body: "Each maturity model consists of several checkpoints that you can rate on a scale. The results are visualised so you can see at a glance where your company stands in terms of SEO.",
          },
        ],
      },
      briefings: {
        title: "Briefings",
        description: "Create and manage content briefings",
        articles: [
          {
            title: "Creating briefings",
            body: "Create structured content briefings for writers and editors. A briefing contains all relevant information such as target keywords, page structure, content requirements and SEO guidelines.",
            link: "/briefings",
            linkLabel: "Go to briefings",
          },
          {
            title: "Status management",
            body: "Each briefing goes through several statuses: Open (created, not yet worked on), In progress (currently being implemented) and Completed. This helps you keep track of the progress of all briefings.",
          },
          {
            title: "Briefing analysis",
            body: "The analysis shows statistics on your briefings: How many are open, in progress or completed? What progress has been made? This overview helps you plan and prioritise.",
            link: "/briefings/auswertung",
            linkLabel: "Go to briefing analysis",
          },
        ],
      },
      tasks: {
        title: "Kanban board",
        description: "Organise and manage tasks visually",
        articles: [
          {
            title: "Task management",
            body: "The Kanban board gives you a visual overview of all SEO tasks. You can create tasks, organise them in columns (e.g. To do, In progress, Done) and move them via drag & drop. Ideal for collaborating as a team.",
            link: "/tasks",
            linkLabel: "Go to Kanban board",
          },
          {
            title: "Creating & editing tasks",
            body: "Create new tasks with a title, description, priority and deadline. Assign tasks to team members and track their progress. Every task can be commented on and enriched with additional details.",
          },
        ],
      },
      reporting: {
        title: "Reporting",
        description: "Generate comprehensive SEO reports",
        articles: [
          {
            title: "Report overview",
            body: "The reporting overview gives you central access to all available report types. From here you can create, view and export various reports.",
            link: "/reporting",
            linkLabel: "Go to reporting",
          },
          {
            title: "Ranking report",
            body: "The ranking report gives you detailed information on how your keyword rankings are developing. You can see which keywords have risen or fallen and analyse trends across different periods.",
            link: "/reporting/ranking",
            linkLabel: "Go to ranking report",
          },
          {
            title: "Traffic report",
            body: "The traffic report analyses your website's organic traffic. It shows how clicks, impressions and CTR are developing and helps you measure the success of your SEO measures.",
            link: "/reporting/traffic",
            linkLabel: "Go to traffic report",
          },
          {
            title: "KVP report & task report",
            body: "The KVP report documents the progress of your continuous improvement process. The task report gives you an overview of all completed and open tasks in the reporting period.",
            link: "/reporting/kvp",
            linkLabel: "Go to KVP report",
          },
        ],
      },
      superagent: {
        title: "SuperAgent",
        description: "AI-powered SEO assistant",
        articles: [
          {
            title: "What is the SuperAgent?",
            body: "The SuperAgent is an AI-powered assistant that helps you with complex SEO tasks. You can ask it questions, request analyses or delegate tasks. It uses the data from your dashboard to give context-aware recommendations.",
            link: "/superagent",
            linkLabel: "Go to SuperAgent",
          },
        ],
      },
      "seo-helper": {
        title: "SEO Helper",
        description: "A collection of useful SEO tools",
        articles: [
          {
            title: "Tool overview",
            body: "The SEO Helper offers a collection of specialised tools for various SEO tasks. All tools can be accessed from the SEO Helper main page.",
            link: "/seo-helper",
            linkLabel: "Go to SEO Helper",
          },
          {
            title: "AI Summarizer",
            body: "The AI Summarizer automatically summarises texts and web pages. Ideal for quickly grasping the content of competitor pages or boiling long texts down to their key messages.",
            link: "/seo-helper/ai-summarizer",
            linkLabel: "Go to AI Summarizer",
          },
          {
            title: "Content Analyzer",
            body: "Analyse the quality and SEO suitability of your content. The Content Analyzer rates texts on criteria such as readability, keyword density and structure, and suggests improvements.",
            link: "/seo-helper/content-analyzer",
            linkLabel: "Go to Content Analyzer",
          },
          {
            title: "Keyword Clustering",
            body: "Automatically group a list of keywords into topical clusters. This shows you which keywords can be covered on a shared page and which need pages of their own.",
            link: "/seo-helper/keyword-clustering",
            linkLabel: "Go to Keyword Clustering",
          },
          {
            title: "More tools",
            body: "The SEO Helper also includes: SERP Preview (preview of your Google search results), Title Generator (AI-generated page titles), FAQ Generator (automatic FAQ creation), Schema Generator (structured data for Google) and the Benchmarker (competitor comparison).",
            link: "/seo-helper",
            linkLabel: "Show all tools",
          },
        ],
      },
      einstellungen: {
        title: "Settings & administration",
        description: "Account, users and system settings",
        articles: [
          {
            title: "Settings",
            body: "In the settings you can edit your profile, connect or disconnect your Google account and adjust other personal preferences.",
            link: "/settings",
            linkLabel: "Go to settings",
          },
          {
            title: "User management (admin)",
            body: "Administrators and agency users have access to user management. Here they can invite new users, assign roles and manage existing accounts.",
            link: "/admin/users",
            linkLabel: "Go to user management",
          },
          {
            title: "Bugs & Features",
            body: "Found a bug or have an idea for a new feature? Use the tickets feature to report bugs and submit feature requests. The development team will be notified and work on them.",
            link: "/tickets",
            linkLabel: "Go to Bugs & Features",
          },
          {
            title: "Changelog",
            body: "The changelog lists all changes and new features made to the SME Dashboard, so you always stay up to date on improvements and new functionality.",
            link: "/changelog",
            linkLabel: "Go to changelog",
          },
        ],
      },
    },
  },
});
