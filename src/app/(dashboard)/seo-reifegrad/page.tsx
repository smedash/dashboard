"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SunburstChart, SunburstChartRef } from "@/components/charts";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { commonMessages } from "@/i18n/messages/common";
import { seoMaturityMessages } from "@/i18n/messages/seo-maturity";
import { seoMaturityItemMessages } from "@/i18n/messages/seo-maturity-items";

interface Team {
  id: string;
  name: string;
}

interface KVPLink {
  linkId: string;
  linkCreatedAt: string;
  kvp: {
    id: string;
    url: string;
    focusKeyword: string;
    category: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

interface SEOMaturityItem {
  id: string;
  category: string;
  title: string;
  description?: string;
  score: number;
  priority?: string | null; // A, B, C, D
  order: number;
  teams?: Array<{
    id: string;
    team: Team;
  }>;
  kvpLinks?: KVPLink[];
}

interface SEOMaturity {
  id: string;
  name: string;
  description?: string;
  items: SEOMaturityItem[];
  createdAt: string;
  updatedAt: string;
}

interface ChangeLogEntry {
  id: string;
  maturityId: string;
  itemId: string | null;
  action: "create" | "update" | "delete";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  itemTitle: string | null;
  itemCategory: string | null;
  userId: string;
  createdAt: string;
}

interface ComparisonDiff {
  category: string;
  title: string;
  type: "added" | "removed" | "changed" | "unchanged";
  baseScore?: number;
  targetScore?: number;
  scoreDiff?: number;
  basePriority?: string | null;
  targetPriority?: string | null;
  baseTeams?: string[];
  targetTeams?: string[];
}

interface ComparisonResult {
  base: { id: string; name: string; itemCount: number; avgScore: number };
  target: { id: string; name: string; itemCount: number; avgScore: number };
  differences: ComparisonDiff[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    avgScoreDiff: number;
  };
}

// Standard SEO Checkliste - aus seo-checkliste.xlsx
const DEFAULT_SEO_ITEMS = [
  // Das Fundament
  { category: "Das Fundament", title: "Google Analytics prüfen und einrichten" },
  { category: "Das Fundament", title: "Google Search Console (GSC) prüfen und einrichten" },
  { category: "Das Fundament", title: "SEO-Lösung für die Website prüfen und installieren" },
  { category: "Das Fundament", title: "Uptime-Monitoring einrichten" },
  { category: "Das Fundament", title: "Prüfen auf Impressum, Kontakt, Datenschutz und AGB-Seiten" },
  { category: "Das Fundament", title: "Keyword-Ranking-Tracking einrichten" },
  
  // Benutzererfahrung
  { category: "Benutzererfahrung", title: "Prüfen auf benutzerfreundliche Permalinks" },
  { category: "Benutzererfahrung", title: "Prüfen ob die Website mobilfreundlich ist" },
  { category: "Benutzererfahrung", title: "Prüfen ob die Website schnell lädt" },
  { category: "Benutzererfahrung", title: "URLs kurz halten" },
  { category: "Benutzererfahrung", title: "404-Seite prüfen und optimieren" },
  { category: "Benutzererfahrung", title: "Content einfach teilbar machen" },
  { category: "Benutzererfahrung", title: "Marke auf mehreren Social-Media-Plattformen beanspruchen" },
  { category: "Benutzererfahrung", title: "Heatmaps verwenden um zu sehen was Nutzer tatsächlich sehen" },
  
  // Performance
  { category: "Performance", title: "Leistungsstarken Webhost verwenden" },
  { category: "Performance", title: "Prüfen ob der Server nahe am Servicegebiet liegt" },
  { category: "Performance", title: "CDN verwenden" },
  { category: "Performance", title: "Prüfen auf GZIP-Komprimierung" },
  { category: "Performance", title: "Prüfen auf HTTP/2" },
  { category: "Performance", title: "Caching-Lösung verwenden" },
  { category: "Performance", title: "JS/CSS-Dateien minifizieren" },
  { category: "Performance", title: "Große Bilder beim Upload anpassen" },
  { category: "Performance", title: "Bilder komprimieren und optimieren" },
  { category: "Performance", title: "Lazy Loading für Bilder & Iframes (YouTube-Einbettungen, etc.)" },
  { category: "Performance", title: "Technologie aktualisieren" },
  { category: "Performance", title: "Datenbank optimieren" },
  
  // Technische SEO
  { category: "Technische SEO", title: "Prüfen auf HTTPS" },
  { category: "Technische SEO", title: "Prüfen auf eine einzige www-Version" },
  { category: "Technische SEO", title: "Mixed Content beheben" },
  { category: "Technische SEO", title: "Sitemap erstellen und zu Google Search Console (GSC) hinzufügen" },
  { category: "Technische SEO", title: "robots.txt-Datei erstellen" },
  { category: "Technische SEO", title: "Prüfen ob URLs Redirects zu / haben oder Canonical auf / gesetzt ist" },
  { category: "Technische SEO", title: "Defekte Links prüfen und beheben" },
  { category: "Technische SEO", title: "Redirect-Ketten prüfen und beheben" },
  { category: "Technische SEO", title: "Fehlende und doppelte Meta-Titles und -Descriptions beheben" },
  { category: "Technische SEO", title: "Redirects korrekt verwenden" },
  { category: "Technische SEO", title: "Prüfen auf Index-Abdeckungsprobleme" },
  { category: "Technische SEO", title: "Prüfen auf manuelle Penalties" },
  { category: "Technische SEO", title: "Seiten maximal 3 Klicks von der Startseite entfernt halten" },
  { category: "Technische SEO", title: "\"noindex\" und \"nofollow\" Tags korrekt verwenden" },
  { category: "Technische SEO", title: "Irrelevante Seiten von der Indexierung ausschließen" },
  
  // Content
  { category: "Content", title: "Solide SEO-Content-Strategie haben" },
  { category: "Content", title: "Keyword-Recherche durchführen" },
  { category: "Content", title: "Langform-Content erstellen" },
  { category: "Content", title: "10x Content erstellen" },
  { category: "Content", title: "Keyword-Kannibalisierung identifizieren und beheben" },
  { category: "Content", title: "Doppelten Content identifizieren und beheben" },
  { category: "Content", title: "Content-Hubs erstellen" },
  { category: "Content", title: "Hubs mit unterstützendem Content \"füttern\"" },
  { category: "Content", title: "Content regelmäßig aktualisieren" },
  { category: "Content", title: "Content zu Kategorien hinzufügen" },
  { category: "Content", title: "E-A-T aufbauen" },
  
  // On-Page SEO
  { category: "On-Page SEO", title: "Für Menschen schreiben, nicht für Suchmaschinen" },
  { category: "On-Page SEO", title: "Prüfen ob das Ziel-Keyword der Nutzerabsicht entspricht" },
  { category: "On-Page SEO", title: "Ziel-Keyword in URL, Title und Überschrift haben" },
  { category: "On-Page SEO", title: "Fokus-Keyword im ersten Absatz verwenden" },
  { category: "On-Page SEO", title: "Ein einzelnes H1 pro Seite verwenden" },
  { category: "On-Page SEO", title: "Ansprechenden, aber SEO-orientierten Meta-Title setzen" },
  { category: "On-Page SEO", title: "Überzeugende Meta-Description schreiben" },
  { category: "On-Page SEO", title: "Unterüberschriften für Content-Hierarchie verwenden" },
  { category: "On-Page SEO", title: "Content korrekt formatieren und stylen" },
  { category: "On-Page SEO", title: "Zu relevanten internen Seiten verlinken" },
  { category: "On-Page SEO", title: "Zu relevanten, autoritativen Websites verlinken" },
  { category: "On-Page SEO", title: "Nie zu einer Seite/Website mit demselben Anchor-Text verlinken, den die aktuelle Seite verwendet" },
  { category: "On-Page SEO", title: "Bilder korrekt benennen" },
  { category: "On-Page SEO", title: "Alt-Texte für Bilder setzen" },
  { category: "On-Page SEO", title: "Prüfen auf Social-Markup" },
  { category: "On-Page SEO", title: "Dwell Time prüfen und optimieren" },
  { category: "On-Page SEO", title: "Auf Featured Snippet abzielen" },
  { category: "On-Page SEO", title: "Nicht überoptimieren" },
  
  // Off-Page SEO
  { category: "Off-Page SEO", title: "Solide Linkbuilding-Strategie haben" },
  { category: "Off-Page SEO", title: "Grundlegende Links aufbauen" },
  { category: "Off-Page SEO", title: "Social-Media-Netzwerke verknüpfen" },
  { category: "Off-Page SEO", title: "Gastbeiträge auf nischenbezogenen Blogs veröffentlichen" },
  { category: "Off-Page SEO", title: "Partner um Links bitten, mit denen man zusammengearbeitet hat" },
  { category: "Off-Page SEO", title: "Markenerwähnungen in Links umwandeln" },
  { category: "Off-Page SEO", title: "Social Signals nutzen um Rankings zu steigern" },
  { category: "Off-Page SEO", title: "Social-Media-Posts planen" },
  
  // Local SEO
  { category: "Local SEO", title: "Google My Business-Eintrag beanspruchen" },
  { category: "Local SEO", title: "Yelp-Eintrag beanspruchen" },
  { category: "Local SEO", title: "Bing Places for Business-Eintrag beanspruchen" },
  { category: "Local SEO", title: "Einträge optimieren" },
  { category: "Local SEO", title: "In allgemeinen relevanten Verzeichnissen eintragen" },
  { category: "Local SEO", title: "In nischen-spezifischen Verzeichnissen eintragen" },
  { category: "Local SEO", title: "Auf Bewertungen antworten" },
  { category: "Local SEO", title: "Um Bewertungen bitten" },
  { category: "Local SEO", title: "Google Posts veröffentlichen" },
  { category: "Local SEO", title: "Prüfen auf siteweite NAP-Details (Name, Adresse, Telefon)" },
  { category: "Local SEO", title: "Konsistente NAP-Details auf der gesamten Website haben" },
  { category: "Local SEO", title: "Konsistente NAP-Details in Einträgen & Social-Media-Netzwerken haben" },
  { category: "Local SEO", title: "Content-Strategie für lokale Themen haben" },
  { category: "Local SEO", title: "Markenerwähnungen von lokalen Websites beanspruchen" },
  { category: "Local SEO", title: "Local Business Markup zur Homepage hinzufügen" },
];

// Übersetzungs-Map für bestehende englische Begriffe
const TRANSLATION_MAP: Record<string, string> = {
  // Kategorien
  "The Foundation": "Das Fundament",
  "User Experience": "Benutzererfahrung",
  "Performance": "Performance",
  "Technical SEO": "Technische SEO",
  "Content": "Content",
  "On-Page SEO": "On-Page SEO",
  "Off-Page SEO": "Off-Page SEO",
  "Local SEO": "Local SEO",
  
  // Titel - The Foundation
  "Check & Set Up Google Analytics": "Google Analytics prüfen und einrichten",
  "Check & Set Up Google Search Console(GSC)": "Google Search Console (GSC) prüfen und einrichten",
  "Check & Install an SEO Solution for Your Website": "SEO-Lösung für die Website prüfen und installieren",
  "Set Up Uptime Monitoring": "Uptime-Monitoring einrichten",
  "Check for About, Contact, Privacy Policy and TOS Pages": "Prüfen auf Impressum, Kontakt, Datenschutz und AGB-Seiten",
  "Set Up Keyword Rank Tracking": "Keyword-Ranking-Tracking einrichten",
  
  // Titel - User Experience
  "Check for Pretty Permalinks": "Prüfen auf benutzerfreundliche Permalinks",
  "Check the Site is Mobile Friendly": "Prüfen ob die Website mobilfreundlich ist",
  "Check the Site Loads Fast": "Prüfen ob die Website schnell lädt",
  "Keep URLs Short": "URLs kurz halten",
  "Check and Optimize Your 404 Page": "404-Seite prüfen und optimieren",
  "Make it Easy to Share Your Content": "Content einfach teilbar machen",
  "Claim Your Brand on Multiple Social Networks": "Marke auf mehreren Social-Media-Plattformen beanspruchen",
  "Use Heatmaps to See What Users Actually See ": "Heatmaps verwenden um zu sehen was Nutzer tatsächlich sehen",
  
  // Titel - Performance
  "Use a Top-Performing Web Host": "Leistungsstarken Webhost verwenden",
  "Check The Server is Located Close to Your Service Area": "Prüfen ob der Server nahe am Servicegebiet liegt",
  "Use a CDN": "CDN verwenden",
  "Check for GZIP Compression": "Prüfen auf GZIP-Komprimierung",
  "Check for HTTP/2": "Prüfen auf HTTP/2",
  "Use a Caching Solution": "Caching-Lösung verwenden",
  "Minify JS/CSS Files": "JS/CSS-Dateien minifizieren",
  "Resize Large Images at Upload": "Große Bilder beim Upload anpassen",
  "Compress and Optimize images": "Bilder komprimieren und optimieren",
  "Lazy Load Images & Iframes(YouTube embeds, etc)": "Lazy Loading für Bilder & Iframes (YouTube-Einbettungen, etc.)",
  "Update Technology": "Technologie aktualisieren",
  "Optimize Database": "Datenbank optimieren",
  
  // Titel - Technical SEO
  "Check for https": "Prüfen auf HTTPS",
  "Check for One Single www Version": "Prüfen auf eine einzige www-Version",
  "Fix mixed content": "Mixed Content beheben",
  "Create a Sitemap & Add it to Google Search Console(GSC)": "Sitemap erstellen und zu Google Search Console (GSC) hinzufügen",
  "Create a robots.txt File": "robots.txt-Datei erstellen",
  "Check that URLs have redirects to / or the canonical is set to /": "Prüfen ob URLs Redirects zu / haben oder Canonical auf / gesetzt ist",
  "Check and Fix Broken Links": "Defekte Links prüfen und beheben",
  "Check and Fix Redirect Chains": "Redirect-Ketten prüfen und beheben",
  "Fix Missing and Duplicate Meta Titles and Descriptions": "Fehlende und doppelte Meta-Titles und -Descriptions beheben",
  "Use Redirects Properly": "Redirects korrekt verwenden",
  "Check for Index Coverage Issues": "Prüfen auf Index-Abdeckungsprobleme",
  "Check for Manual Penalties": "Prüfen auf manuelle Penalties",
  "Keep Pages at Maximum 3 Clicks from Reach": "Seiten maximal 3 Klicks von der Startseite entfernt halten",
  "Use \"noindex\" and \"nofollow\" Tags Properly": "\"noindex\" und \"nofollow\" Tags korrekt verwenden",
  "Disable Irrelevant Pages from Being Indexed": "Irrelevante Seiten von der Indexierung ausschließen",
  
  // Titel - Content
  "Have a Solid SEO Content Strategy": "Solide SEO-Content-Strategie haben",
  "Do Keyword Research": "Keyword-Recherche durchführen",
  "Create Long-Form Content": "Langform-Content erstellen",
  "Create 10x Content": "10x Content erstellen",
  "Identify & Fix Keyword Cannibalization": "Keyword-Kannibalisierung identifizieren und beheben",
  "Identify and Fix Duplicate Content": "Doppelten Content identifizieren und beheben",
  "Create Content Hubs": "Content-Hubs erstellen",
  "\"Feed\" the Hubs with Supporting Content": "Hubs mit unterstützendem Content \"füttern\"",
  "Update Content on a Regular Basis": "Content regelmäßig aktualisieren",
  "Add Content to Your Categories": "Content zu Kategorien hinzufügen",
  "Build Up E-A-T": "E-A-T aufbauen",
  
  // Titel - On-Page SEO
  "Write for People, not for Search Engines": "Für Menschen schreiben, nicht für Suchmaschinen",
  "Check the Target Keyword Matches User Intent": "Prüfen ob das Ziel-Keyword der Nutzerabsicht entspricht",
  "Have the target keyword in URL, Title and Heading": "Ziel-Keyword in URL, Title und Überschrift haben",
  "Use Focus Keyword in 1st Paragraph": "Fokus-Keyword im ersten Absatz verwenden",
  "Use a Single H1 on Each Page": "Ein einzelnes H1 pro Seite verwenden",
  "Set an Enticing, yet SEO-Oriented Meta Title": "Ansprechenden, aber SEO-orientierten Meta-Title setzen",
  "Write a Compelling Meta Description": "Überzeugende Meta-Description schreiben",
  "Use Subheadings for Content Hierarchy": "Unterüberschriften für Content-Hierarchie verwenden",
  "Format and Style the Content Properly": "Content korrekt formatieren und stylen",
  "Link to Relevant Inner Pages": "Zu relevanten internen Seiten verlinken",
  "Link out to relevant, authoritative websites": "Zu relevanten, autoritativen Websites verlinken",
  "Never Link to a Page/Website with the Same Anchor the Current Page is Targeting": "Nie zu einer Seite/Website mit demselben Anchor-Text verlinken, den die aktuelle Seite verwendet",
  "Name Your Images Properly": "Bilder korrekt benennen",
  "Set Images Alt Text": "Alt-Texte für Bilder setzen",
  "Check for Social Markup": "Prüfen auf Social-Markup",
  "Check Dwell Time and Optimize It": "Dwell Time prüfen und optimieren",
  "Strike for the Featured Snippet": "Auf Featured Snippet abzielen",
  "Don't Over-Optimize": "Nicht überoptimieren",
  
  // Titel - Off-Page SEO
  "Have a Solid Link Building Strategy": "Solide Linkbuilding-Strategie haben",
  "Build Foundational Links": "Grundlegende Links aufbauen",
  "Interlink Social Networks": "Social-Media-Netzwerke verknüpfen",
  "Guest Post on Niche-Related Blogs": "Gastbeiträge auf nischenbezogenen Blogs veröffentlichen",
  "Ask Partners you've Worked with for a Link": "Partner um Links bitten, mit denen man zusammengearbeitet hat",
  "Turn Brand Mentions into Links": "Markenerwähnungen in Links umwandeln",
  "Use Social Signals to Boost your Page Rankings": "Social Signals nutzen um Rankings zu steigern",
  "Schedule Social Posting": "Social-Media-Posts planen",
  
  // Titel - Local SEO
  "Claim your Google My Business Listing": "Google My Business-Eintrag beanspruchen",
  "Claim Your Yelp Listing": "Yelp-Eintrag beanspruchen",
  "Claim your Bing Places for Business Listing": "Bing Places for Business-Eintrag beanspruchen",
  "Optimize Listings": "Einträge optimieren",
  "Get on General Relevant Directories": "In allgemeinen relevanten Verzeichnissen eintragen",
  "Get on Niche-specific Directories": "In nischen-spezifischen Verzeichnissen eintragen",
  "Reply to Reviews": "Auf Bewertungen antworten",
  "Reach Out for Reviews": "Um Bewertungen bitten",
  "Publish Google Posts": "Google Posts veröffentlichen",
  "Check for Site-wide NAP Details": "Prüfen auf siteweite NAP-Details (Name, Adresse, Telefon)",
  "Have Consistent NAP Details Across the Site": "Konsistente NAP-Details auf der gesamten Website haben",
  "Have Consistent NAP Details on Listings & Social Networks": "Konsistente NAP-Details in Einträgen & Social-Media-Netzwerken haben",
  "Have a Content Strategy Targeting Local Topics": "Content-Strategie für lokale Themen haben",
  "Claim Brand Mentions from Local Sites": "Markenerwähnungen von lokalen Websites beanspruchen",
  "Add Local Business Markup  to your Homepage": "Local Business Markup zur Homepage hinzufügen",
};

// Funktion zum Übersetzen von Items
const translateItems = (items: SEOMaturityItem[]): SEOMaturityItem[] => {
  return items.map((item) => ({
    ...item,
    category: TRANSLATION_MAP[item.category] || item.category,
    title: TRANSLATION_MAP[item.title] || item.title,
  }));
};

export default function SEOMaturityPage() {
  const t = useMessages(seoMaturityMessages);
  const tc = useMessages(commonMessages);
  const ti = useMessages(seoMaturityItemMessages);
  const { intlLocale } = useLocale();
  const categoryLabel = (category: string) => ti.categories[category] ?? category;
  const itemTitleLabel = (title: string) => ti.titles[title] ?? title;
  const [maturities, setMaturities] = useState<SEOMaturity[]>([]);
  const [selectedMaturity, setSelectedMaturity] = useState<SEOMaturity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMaturityName, setNewMaturityName] = useState("");
  const [newMaturityDescription, setNewMaturityDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [descriptionText, setDescriptionText] = useState<string>("");
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState<string | null>(null);
  const [newItemCategory, setNewItemCategory] = useState<string>("");
  const [newItemCategoryInput, setNewItemCategoryInput] = useState<string>("");
  const [newItemTitle, setNewItemTitle] = useState<string>("");
  const [newItemDescription, setNewItemDescription] = useState<string>("");
  const [newItemScore, setNewItemScore] = useState<number>(1);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string[]>>({});
  const [scoreFilter, setScoreFilter] = useState<{ min: number; max: number }>({ min: 1, max: 10 });
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [kvpLinksMap, setKvpLinksMap] = useState<Record<string, KVPLink[]>>({});
  const [expandedKvpItems, setExpandedKvpItems] = useState<string[]>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemCategoryInput, setEditItemCategoryInput] = useState("");
  const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogTotal, setChangeLogTotal] = useState(0);
  const [isLoadingChangeLog, setIsLoadingChangeLog] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [compareBaseId, setCompareBaseId] = useState<string>("");
  const [compareTargetId, setCompareTargetId] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compareFilterType, setCompareFilterType] = useState<string>("all");
  
  // Ref für SunburstChart Export
  const sunburstChartRef = useRef<SunburstChartRef>(null);
  
  // Refs für Debouncing der Score-Updates
  const scoreUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const scoreUpdateAbortControllers = useRef<Record<string, AbortController>>({});

  // Export-Handler
  const handleExportChart = () => {
    if (sunburstChartRef.current) {
      const date = new Date().toISOString().split('T')[0];
      const maturityName = selectedMaturity?.name.replace(/\s+/g, '-').toLowerCase() || 'chart';
      sunburstChartRef.current.exportToPng(`seo-reifegrad-${maturityName}-${date}.png`);
    }
  };

  useEffect(() => {
    fetchMaturities();
    fetchTeams();
    
    // Cleanup bei Unmount
    return () => {
      // Alle Timeouts löschen
      Object.values(scoreUpdateTimeouts.current).forEach(clearTimeout);
      // Alle laufenden Requests abbrechen
      Object.values(scoreUpdateAbortControllers.current).forEach(controller => controller.abort());
    };
  }, []);

  // Lade KVP-Links wenn eine Maturity ausgewählt wird
  useEffect(() => {
    if (selectedMaturity) {
      selectedMaturity.items.forEach((item) => {
        fetchKvpLinksForItem(selectedMaturity.id, item.id);
      });
    }
  }, [selectedMaturity?.id]);

  const fetchKvpLinksForItem = async (maturityId: string, itemId: string) => {
    try {
      const response = await fetch(`/api/seo-maturity/${maturityId}/items/${itemId}/kvp-links`);
      const data = await response.json();
      if (data.links) {
        setKvpLinksMap((prev) => ({
          ...prev,
          [itemId]: data.links,
        }));
      }
    } catch (error) {
      console.error("Error fetching KVP links:", error);
    }
  };

  const toggleKvpExpansion = (itemId: string) => {
    setExpandedKvpItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch("/api/seo-maturity/teams");
      const data = await response.json();
      setAvailableTeams(data.teams || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const fetchMaturities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/seo-maturity");
      const data = await response.json();
      // Übersetze bestehende Analysen
      const translatedMaturities = (data.maturities || []).map((maturity: SEOMaturity) => ({
        ...maturity,
        items: translateItems(maturity.items),
      }));
      setMaturities(translatedMaturities);
      if (translatedMaturities.length > 0 && !selectedMaturity) {
        // Modal zur Auswahl anzeigen statt automatisch das neueste zu laden
        setShowSelectionModal(true);
      }
    } catch (error) {
      console.error("Error fetching maturities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectMaturity = (maturity: SEOMaturity) => {
    setSelectedMaturity(maturity);
    // Initialisiere selectedTeams für alle Items
    const teamsMap: Record<string, string[]> = {};
    maturity.items.forEach((item: SEOMaturityItem) => {
      teamsMap[item.id] = item.teams?.map((t) => t.team.id) || [];
    });
    setSelectedTeams(teamsMap);
    setShowSelectionModal(false);
  };

  const createNewMaturity = async () => {
    if (!newMaturityName.trim()) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/seo-maturity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMaturityName,
          description: newMaturityDescription || null,
          items: DEFAULT_SEO_ITEMS.map((item, index) => ({
            ...item,
            score: 1,
            order: index,
          })),
        }),
      });

      const data = await response.json();
      if (data.maturity) {
        // Neue Analysen sind bereits auf Deutsch, aber für Konsistenz übersetzen wir sie auch
        const translatedMaturity = {
          ...data.maturity,
          items: translateItems(data.maturity.items),
        };
        setMaturities([translatedMaturity, ...maturities]);
        setSelectedMaturity(translatedMaturity);
        setShowNewForm(false);
        setNewMaturityName("");
        setNewMaturityDescription("");
      }
    } catch (error) {
      console.error("Error creating maturity:", error);
      alert(t.errors.create);
    } finally {
      setIsSaving(false);
    }
  };

  // Optimistisches Update + Debounced API-Call für Score
  const updateItemScoreOptimistic = useCallback((itemId: string, score: number) => {
    if (!selectedMaturity) return;

    // Sofort lokalen State aktualisieren (optimistisches Update)
    const updatedItems = selectedMaturity.items.map((item) =>
      item.id === itemId ? { ...item, score } : item
    );
    setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
  }, [selectedMaturity]);

  const updateItemScoreDebounced = useCallback((itemId: string, score: number, maturityId: string) => {
    // Bestehenden Timeout für dieses Item löschen
    if (scoreUpdateTimeouts.current[itemId]) {
      clearTimeout(scoreUpdateTimeouts.current[itemId]);
    }

    // Bestehenden Request abbrechen
    if (scoreUpdateAbortControllers.current[itemId]) {
      scoreUpdateAbortControllers.current[itemId].abort();
    }

    // Neuen Timeout setzen (500ms Debounce)
    scoreUpdateTimeouts.current[itemId] = setTimeout(async () => {
      const abortController = new AbortController();
      scoreUpdateAbortControllers.current[itemId] = abortController;

      try {
        const response = await fetch(
          `/api/seo-maturity/${maturityId}/items/${itemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update score");
        }

        // Bei Erfolg nichts tun - der lokale State ist bereits aktualisiert
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request wurde absichtlich abgebrochen - ignorieren
          return;
        }
        console.error("Error updating item score:", error);
        // Optional: Bei Fehler könnte man den alten Wert wiederherstellen
      }
    }, 500);
  }, []);

  const updateItemScore = useCallback((itemId: string, score: number) => {
    if (!selectedMaturity) return;
    
    // 1. Sofort lokalen State aktualisieren
    updateItemScoreOptimistic(itemId, score);
    
    // 2. API-Call mit Debouncing
    updateItemScoreDebounced(itemId, score, selectedMaturity.id);
  }, [selectedMaturity, updateItemScoreOptimistic, updateItemScoreDebounced]);

  const updateItemPriority = async (itemId: string, priority: string | null) => {
    if (!selectedMaturity) return;

    try {
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority }),
        }
      );

      const data = await response.json();
      if (data.item) {
        const updatedItems = selectedMaturity.items.map((item) =>
          item.id === itemId ? { ...item, priority: data.item.priority, teams: data.item.teams } : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
      }
    } catch (error) {
      console.error("Error updating item priority:", error);
    }
  };

  const updateItemTeams = async (itemId: string, teamIds: string[]) => {
    if (!selectedMaturity) return;

    try {
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamIds }),
        }
      );

      const data = await response.json();
      if (data.item) {
        const updatedItems = selectedMaturity.items.map((item) =>
          item.id === itemId ? { ...item, teams: data.item.teams } : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
        setSelectedTeams({ ...selectedTeams, [itemId]: teamIds });
      }
    } catch (error) {
      console.error("Error updating item teams:", error);
    }
  };

  const startEditingDescription = (itemId: string, currentDescription?: string) => {
    setEditingDescription(itemId);
    setDescriptionText(currentDescription || "");
  };

  const cancelEditingDescription = () => {
    setEditingDescription(null);
    setDescriptionText("");
  };

  const saveDescription = async (itemId: string) => {
    if (!selectedMaturity) return;

    try {
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: descriptionText.trim() || null }),
        }
      );

      const data = await response.json();
      if (data.item) {
        const updatedItems = selectedMaturity.items.map((item) =>
          item.id === itemId ? { ...item, description: data.item.description } : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
        setEditingDescription(null);
        setDescriptionText("");
      }
    } catch (error) {
      console.error("Error updating item description:", error);
      alert(t.errors.saveDescription);
    }
  };

  const addNewItem = async (category: string) => {
    if (!selectedMaturity || !newItemTitle.trim()) return;

    try {
      setIsAddingItem(true);
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: category || newItemCategory || "Allgemein",
            title: newItemTitle.trim(),
            description: newItemDescription.trim() || null,
            score: newItemScore,
          }),
        }
      );

      const data = await response.json();
      if (data.item) {
        // Übersetze das neue Item
        const translatedItem = {
          ...data.item,
          category: TRANSLATION_MAP[data.item.category] || data.item.category,
          title: TRANSLATION_MAP[data.item.title] || data.item.title,
        };
        
        const updatedItems = [...selectedMaturity.items, translatedItem].sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.order - b.order;
        });
        
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
        setSelectedTeams({ ...selectedTeams, [translatedItem.id]: translatedItem.teams?.map((t: any) => t.team.id) || [] });
        setShowAddItemForm(null);
        setNewItemCategory("");
        setNewItemTitle("");
        setNewItemDescription("");
        setNewItemScore(1);
      }
    } catch (error) {
      console.error("Error adding item:", error);
      alert(t.errors.addItem);
    } finally {
      setIsAddingItem(false);
    }
  };

  const startEditingItem = (item: SEOMaturityItem) => {
    setEditingItem(item.id);
    setEditItemTitle(item.title);
    setEditItemCategory(item.category);
    setEditItemCategoryInput("");
  };

  const cancelEditingItem = () => {
    setEditingItem(null);
    setEditItemTitle("");
    setEditItemCategory("");
    setEditItemCategoryInput("");
  };

  const saveItemEdit = async (itemId: string) => {
    if (!selectedMaturity || !editItemTitle.trim()) return;

    const finalCategory = editItemCategory === "__new__"
      ? (editItemCategoryInput.trim() || "Allgemein")
      : editItemCategory;

    try {
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editItemTitle.trim(),
            category: finalCategory,
          }),
        }
      );

      const data = await response.json();
      if (data.item) {
        const updatedItems = selectedMaturity.items.map((item) =>
          item.id === itemId
            ? { ...item, title: data.item.title, category: data.item.category }
            : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
        cancelEditingItem();
      }
    } catch (error) {
      console.error("Error updating item:", error);
      alert(t.errors.saveChanges);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!selectedMaturity) return;

    try {
      setIsDeletingItem(itemId);
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        const updatedItems = selectedMaturity.items.filter((item) => item.id !== itemId);
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
        const { [itemId]: _, ...restTeams } = selectedTeams;
        setSelectedTeams(restTeams);
        const { [itemId]: __, ...restKvp } = kvpLinksMap;
        setKvpLinksMap(restKvp);
        setConfirmDeleteItem(null);
      } else {
        alert(t.errors.deleteItem);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert(t.errors.deleteItem);
    } finally {
      setIsDeletingItem(null);
    }
  };

  const fetchChangeLog = async (maturityId: string) => {
    try {
      setIsLoadingChangeLog(true);
      const response = await fetch(`/api/seo-maturity/${maturityId}/changelog?limit=200`);
      const data = await response.json();
      setChangeLog(data.logs || []);
      setChangeLogTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching changelog:", error);
    } finally {
      setIsLoadingChangeLog(false);
    }
  };

  const runComparison = async () => {
    if (!compareBaseId || !compareTargetId) return;

    try {
      setIsComparing(true);
      const response = await fetch(
        `/api/seo-maturity/compare?base=${compareBaseId}&target=${compareTargetId}`
      );
      const data = await response.json();
      if (data.differences) {
        setComparisonResult(data);
      } else {
        alert(t.errors.compare);
      }
    } catch (error) {
      console.error("Error comparing:", error);
      alert(t.errors.compareAnalyses);
    } finally {
      setIsComparing(false);
    }
  };

  const getFieldLabel = (field: string | null): string => {
    return field ? t.fieldLabels[field] || field : "";
  };

  const getActionLabel = (action: string): string => {
    return t.actionLabels[action] || action;
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case "create": return "text-green-400";
      case "update": return "text-blue-400";
      case "delete": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  const formatChangeLogDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ChangeLog-Einträge nach Datum gruppieren
  const groupChangeLogByDate = (logs: ChangeLogEntry[]) => {
    const groups: Record<string, ChangeLogEntry[]> = {};
    logs.forEach((log) => {
      const dateKey = new Date(log.createdAt).toLocaleDateString(intlLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  };

  const getAvailableCategories = (): string[] => {
    if (!selectedMaturity) return [];
    const categories = new Set(selectedMaturity.items.map((item) => item.category));
    return Array.from(categories).sort();
  };

  const getScoreColor = (score: number): string => {
    if (score <= 3) return "bg-red-500";
    if (score <= 5) return "bg-orange-500";
    if (score <= 7) return "bg-blue-500";
    return "bg-green-500";
  };

  const getScoreText = (score: number): string => {
    if (score <= 3) return t.scoreText.immature;
    if (score <= 5) return t.scoreText.lowMaturity;
    if (score <= 7) return t.scoreText.mature;
    return t.scoreText.fullyMature;
  };

  const getPriorityColor = (priority: string | null | undefined): string => {
    if (!priority) return "bg-slate-600";
    switch (priority.toUpperCase()) {
      case "A":
        return "bg-white text-slate-900";
      case "B":
        return "bg-slate-200 text-slate-900";
      case "C":
        return "bg-slate-400 text-white";
      case "D":
        return "bg-slate-500 text-white";
      default:
        return "bg-slate-600";
    }
  };

  // SEO-Erklärungen für jeden Punkt
  const getSEOExplanation = (title: string): string => {
    return ti.explanations[title] || ti.defaultExplanation;
  };

  const prepareSunburstData = () => {
    if (!selectedMaturity) return [];

    // Filtere Items basierend auf Reifegrad, Priorität und Teams
    const filteredItems = selectedMaturity.items.filter((item) => {
      // Reifegrad-Filter
      const scoreMatch = item.score >= scoreFilter.min && item.score <= scoreFilter.max;
      
      // Prioritäts-Filter
      let priorityMatch = true;
      if (priorityFilter.length > 0) {
        const itemPriority = item.priority ? item.priority.toUpperCase() : null;
        priorityMatch = priorityFilter.some((filterPriority) => {
          if (filterPriority === "KEINE") {
            return itemPriority === null;
          }
          return itemPriority === filterPriority;
        });
      }
      
      // Team-Filter
      let teamMatch = true;
      if (teamFilter.length > 0) {
        const itemTeamIds = item.teams?.map((t) => t.team.id) || [];
        teamMatch = teamFilter.some((filterTeamId) => itemTeamIds.includes(filterTeamId));
      }
      
      return scoreMatch && priorityMatch && teamMatch;
    });

    const categoryMap = new Map<string, SEOMaturityItem[]>();
    filteredItems.forEach((item) => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, []);
      }
      categoryMap.get(item.category)!.push(item);
    });

    return Array.from(categoryMap.entries()).map(([category, items]) => ({
      name: categoryLabel(category),
      value: items.reduce((sum, item) => sum + item.score, 0) / items.length,
      score: items.reduce((sum, item) => sum + item.score, 0) / items.length,
      children: items.map((item) => ({
        name: itemTitleLabel(item.title),
        value: item.score,
        score: item.score,
        priority: item.priority || null,
        teams: item.teams || [],
      })),
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Auswahl-Modal */}
      {showSelectionModal && maturities.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">{t.selectionModal.title}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {t.selectionModal.description}
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {maturities.map((maturity) => {
                  const avgScore =
                    maturity.items.length > 0
                      ? maturity.items.reduce((sum, item) => sum + item.score, 0) / maturity.items.length
                      : 0;
                  const categories = new Set(maturity.items.map((item) => item.category));
                  const createdDate = new Date(maturity.createdAt).toLocaleDateString(intlLocale, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const updatedDate = new Date(maturity.updatedAt).toLocaleDateString(intlLocale, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });

                  return (
                    <button
                      key={maturity.id}
                      onClick={() => selectMaturity(maturity)}
                      className="w-full text-left p-4 bg-slate-900 hover:bg-slate-750 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {maturity.name}
                          </h3>
                          {maturity.description && (
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                              {maturity.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {t.selectionModal.created(createdDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t.selectionModal.updated(updatedDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {t.selectionModal.items(maturity.items.length)}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {t.selectionModal.categories(categories.size)}
                            </span>
                          </div>
                        </div>
                        {/* Durchschnittlicher Score */}
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                              avgScore <= 3
                                ? "bg-red-500"
                                : avgScore <= 5
                                ? "bg-orange-500"
                                : avgScore <= 7
                                ? "bg-blue-500"
                                : "bg-green-500"
                            }`}
                          >
                            {avgScore.toFixed(1)}
                          </div>
                          <span className="text-xs text-slate-500 mt-1">{t.selectionModal.avgScore}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {t.selectionModal.available(maturities.length)}
              </p>
              <button
                onClick={() => {
                  setShowSelectionModal(false);
                  setShowNewForm(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.selectionModal.createNew}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <div className="flex gap-4">
          {maturities.length > 0 && (
            <select
              value={selectedMaturity?.id || ""}
              onChange={(e) => {
                const maturity = maturities.find((m) => m.id === e.target.value);
                if (maturity) {
                  selectMaturity(maturity);
                } else {
                  setSelectedMaturity(null);
                  setSelectedTeams({});
                }
              }}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              {maturities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showNewForm ? tc.actions.cancel : t.newAnalysis}
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">{t.newForm.title}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.newForm.name}
              </label>
              <input
                type="text"
                value={newMaturityName}
                onChange={(e) => setNewMaturityName(e.target.value)}
                placeholder={t.newForm.namePlaceholder}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.newForm.description}
              </label>
              <textarea
                value={newMaturityDescription}
                onChange={(e) => setNewMaturityDescription(e.target.value)}
                placeholder={t.newForm.descriptionPlaceholder}
                rows={3}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <button
              onClick={createNewMaturity}
              disabled={isSaving || !newMaturityName.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? t.newForm.creating : t.newForm.create}
            </button>
          </div>
        </div>
      )}

      {selectedMaturity ? (
        <>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-2">{selectedMaturity.name}</h2>
            {selectedMaturity.description && (
              <p className="text-slate-400 mb-6">{selectedMaturity.description}</p>
            )}

            {/* Sunburst Chart */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{t.overview}</h3>
                  <button
                    onClick={handleExportChart}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                    title={t.exportPngTitle}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t.exportPng}
                  </button>
                </div>
                
                {/* Filter */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Reifegrad-Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-300 whitespace-nowrap">{t.filters.maturity}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={scoreFilter.min}
                        onChange={(e) => setScoreFilter({ ...scoreFilter, min: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={scoreFilter.max}
                        onChange={(e) => setScoreFilter({ ...scoreFilter, max: Math.max(1, Math.min(10, parseInt(e.target.value) || 10)) })}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Prioritäts-Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-300 whitespace-nowrap">{t.filters.priority}</label>
                    <div className="flex flex-wrap gap-2">
                      {["A", "B", "C", "D", "KEINE"].map((priority) => {
                        const isSelected = priorityFilter.includes(priority);
                        return (
                          <button
                            key={priority}
                            onClick={() => {
                              if (isSelected) {
                                setPriorityFilter(priorityFilter.filter((p) => p !== priority));
                              } else {
                                setPriorityFilter([...priorityFilter, priority]);
                              }
                            }}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              isSelected
                                ? priority === "KEINE"
                                  ? "bg-slate-600 text-white"
                                  : priority === "A"
                                  ? "bg-white text-slate-900"
                                  : priority === "B"
                                  ? "bg-slate-200 text-slate-900"
                                  : priority === "C"
                                  ? "bg-slate-400 text-white"
                                  : "bg-slate-500 text-white"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {priority === "KEINE" ? t.filters.none : priority}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Team-Filter */}
                  {availableTeams.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300 whitespace-nowrap">{t.filters.teams}</label>
                      <div className="flex flex-wrap gap-2">
                        {availableTeams.map((team) => {
                          const isSelected = teamFilter.includes(team.id);
                          return (
                            <button
                              key={team.id}
                              onClick={() => {
                                if (isSelected) {
                                  setTeamFilter(teamFilter.filter((id) => id !== team.id));
                                } else {
                                  setTeamFilter([...teamFilter, team.id]);
                                }
                              }}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                isSelected
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              }`}
                            >
                              {team.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Filter zurücksetzen */}
                  {(scoreFilter.min !== 1 || scoreFilter.max !== 10 || priorityFilter.length > 0 || teamFilter.length > 0) && (
                    <button
                      onClick={() => {
                        setScoreFilter({ min: 1, max: 10 });
                        setPriorityFilter([]);
                        setTeamFilter([]);
                      }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                    >
                      {t.filters.reset}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-center w-full overflow-x-auto">
                <SunburstChart ref={sunburstChartRef} data={prepareSunburstData()} width={1200} height={1200} />
              </div>
            </div>

            {/* Checkliste */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">{t.checklist}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Kategorie-Filter */}
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const categoryId = e.target.value;
                          const element = document.getElementById(`category-${categoryId}`);
                          if (element) {
                            // Scroll zu der Kategorie
                            const yOffset = -20; // Offset für bessere Sichtbarkeit
                            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                            window.scrollTo({ top: y, behavior: "smooth" });
                            
                            // Highlight-Effekt
                            element.classList.add("ring-2", "ring-blue-500", "ring-offset-2", "ring-offset-slate-900");
                            setTimeout(() => {
                              element.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "ring-offset-slate-900");
                            }, 2000);
                          }
                          // Reset select
                          e.target.value = "";
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm cursor-pointer hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {t.jumpToCategory}
                      </option>
                      {Array.from(new Set(selectedMaturity.items.map((item) => item.category)))
                        .sort()
                        .map((category) => (
                          <option key={category} value={category.replace(/\s+/g, "-")}>
                            {categoryLabel(category)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowAddItemForm("new")}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.addNewItem}
                  </button>
                </div>
              </div>

              {/* Formular zum Hinzufügen eines neuen Punktes */}
              {showAddItemForm === "new" && (
                <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
                  <h4 className="text-md font-semibold text-white mb-4">{t.addNewItem}</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        {t.addItemForm.category}
                      </label>
                      <select
                        value={newItemCategory}
                        onChange={(e) => {
                          setNewItemCategory(e.target.value);
                          if (e.target.value !== "__new__") {
                            setNewItemCategoryInput("");
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                      >
                        <option value="">{t.addItemForm.selectCategory}</option>
                        {getAvailableCategories().map((cat) => (
                          <option key={cat} value={cat}>
                            {categoryLabel(cat)}
                          </option>
                        ))}
                        <option value="__new__">{t.addItemForm.createCategory}</option>
                      </select>
                      {newItemCategory === "__new__" && (
                        <input
                          type="text"
                          value={newItemCategoryInput}
                          onChange={(e) => setNewItemCategoryInput(e.target.value)}
                          placeholder={t.addItemForm.newCategoryPlaceholder}
                          className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        {t.addItemForm.title}
                      </label>
                      <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        placeholder={t.addItemForm.titlePlaceholder}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        {t.addItemForm.description}
                      </label>
                      <textarea
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder={t.addItemForm.descriptionPlaceholder}
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        {t.addItemForm.initialScore(newItemScore)}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={newItemScore}
                        onChange={(e) => setNewItemScore(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const category = newItemCategory === "__new__" 
                            ? (newItemCategoryInput.trim() || "Allgemein")
                            : (newItemCategory.trim() || "Allgemein");
                          addNewItem(category);
                        }}
                        disabled={isAddingItem || !newItemTitle.trim() || (!newItemCategory || (newItemCategory === "__new__" && !newItemCategoryInput.trim()))}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                      >
                        {isAddingItem ? t.addItemForm.adding : t.addItemForm.add}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddItemForm(null);
                          setNewItemCategory("");
                          setNewItemCategoryInput("");
                          setNewItemTitle("");
                          setNewItemDescription("");
                          setNewItemScore(1);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        {tc.actions.cancel}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {Array.from(new Set(selectedMaturity.items.map((item) => item.category))).map(
                (category) => (
                  <div 
                    key={category} 
                    id={`category-${category.replace(/\s+/g, "-")}`}
                    className="space-y-3 scroll-mt-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-md font-semibold text-slate-300">{categoryLabel(category)}</h4>
                      <button
                        onClick={() => {
                          setShowAddItemForm(category);
                          setNewItemCategory(category);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t.addItem}
                      </button>
                    </div>

                    {/* Formular zum Hinzufügen eines Punktes zu einer Kategorie */}
                    {showAddItemForm === category && (
                      <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 mb-3">
                        <h5 className="text-sm font-semibold text-white mb-3">{t.addItemForm.addToCategory(categoryLabel(category))}</h5>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              {t.addItemForm.title}
                            </label>
                            <input
                              type="text"
                              value={newItemTitle}
                              onChange={(e) => setNewItemTitle(e.target.value)}
                              placeholder={t.addItemForm.titlePlaceholder}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              {t.addItemForm.description}
                            </label>
                            <textarea
                              value={newItemDescription}
                              onChange={(e) => setNewItemDescription(e.target.value)}
                              placeholder={t.addItemForm.descriptionPlaceholder}
                              rows={2}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              {t.addItemForm.initialScore(newItemScore)}
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={newItemScore}
                              onChange={(e) => setNewItemScore(parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addNewItem(category)}
                              disabled={isAddingItem || !newItemTitle.trim()}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                            >
                              {isAddingItem ? t.addItemForm.adding : t.addItemForm.add}
                            </button>
                            <button
                              onClick={() => {
                                setShowAddItemForm(null);
                                setNewItemCategory("");
                                setNewItemCategoryInput("");
                                setNewItemTitle("");
                                setNewItemDescription("");
                                setNewItemScore(1);
                              }}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                            >
                              {tc.actions.cancel}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {selectedMaturity.items
                        .filter((item) => item.category === category)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700"
                          >
                            <div className="flex-1">
                              {editingItem === item.id ? (
                                <div className="space-y-3 mb-2">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.editItem.title}</label>
                                    <input
                                      type="text"
                                      value={editItemTitle}
                                      onChange={(e) => setEditItemTitle(e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveItemEdit(item.id);
                                        if (e.key === "Escape") cancelEditingItem();
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.editItem.category}</label>
                                    <select
                                      value={editItemCategory}
                                      onChange={(e) => {
                                        setEditItemCategory(e.target.value);
                                        if (e.target.value !== "__new__") setEditItemCategoryInput("");
                                      }}
                                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                                    >
                                      {getAvailableCategories().map((cat) => (
                                        <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                                      ))}
                                      <option value="__new__">{t.addItemForm.createCategory}</option>
                                    </select>
                                    {editItemCategory === "__new__" && (
                                      <input
                                        type="text"
                                        value={editItemCategoryInput}
                                        onChange={(e) => setEditItemCategoryInput(e.target.value)}
                                        placeholder={t.addItemForm.newCategoryPlaceholder}
                                        className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                                      />
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveItemEdit(item.id)}
                                      disabled={!editItemTitle.trim() || (editItemCategory === "__new__" && !editItemCategoryInput.trim())}
                                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                                    >
                                      {tc.actions.save}
                                    </button>
                                    <button
                                      onClick={cancelEditingItem}
                                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                    >
                                      {tc.actions.cancel}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                              <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-medium text-white">{itemTitleLabel(item.title)}</h5>
                                <div className="relative">
                                  <button
                                    onMouseEnter={() => setHoveredInfo(item.id)}
                                    onMouseLeave={() => setHoveredInfo(null)}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                  </button>
                                  {hoveredInfo === item.id && (
                                    <div className="absolute left-0 top-6 z-50 w-80 p-4 bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
                                      {/* Pfeil nach oben */}
                                      <div className="absolute -top-2 left-4 w-4 h-4 bg-slate-800 border-l border-t border-slate-600 transform rotate-45"></div>
                                      <div className="flex items-start gap-2 relative">
                                        <svg
                                          className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                        <div>
                                          <h6 className="text-sm font-semibold text-white mb-2">
                                            {t.whyImportant}
                                          </h6>
                                          <p className="text-sm text-slate-300 leading-relaxed">
                                            {getSEOExplanation(item.title)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                    <button
                                      onClick={() => startEditingItem(item)}
                                      className="text-slate-500 hover:text-blue-400 transition-colors ml-1"
                                      title={t.editItemTitle}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    {confirmDeleteItem === item.id ? (
                                      <div className="flex items-center gap-1 ml-1">
                                        <button
                                          onClick={() => deleteItem(item.id)}
                                          disabled={isDeletingItem === item.id}
                                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                        >
                                          {isDeletingItem === item.id ? "..." : t.confirmDelete}
                                        </button>
                                        <button
                                          onClick={() => setConfirmDeleteItem(null)}
                                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                                        >
                                          {t.no}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setConfirmDeleteItem(item.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                                        title={t.deleteItemTitle}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    )}
                              </div>
                                </>
                              )}
                              {editingDescription === item.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={descriptionText}
                                    onChange={(e) => setDescriptionText(e.target.value)}
                                    placeholder={t.explanationPlaceholder}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveDescription(item.id)}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                    >
                                      {tc.actions.save}
                                    </button>
                                    <button
                                      onClick={cancelEditingDescription}
                                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                    >
                                      {tc.actions.cancel}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {item.description ? (
                                    <p className="text-sm text-slate-400">{item.description}</p>
                                  ) : (
                                    <p className="text-sm text-slate-500 italic">{t.noExplanation}</p>
                                  )}
                                  <button
                                    onClick={() => startEditingDescription(item.id, item.description)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    {item.description ? tc.actions.edit : t.addExplanation}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-4 shrink-0">
                              {/* Score-Kreis */}
                              <div className="flex flex-col items-center" style={{ minWidth: '130px' }}>
                                <div
                                  className={`w-12 h-12 rounded-full ${getScoreColor(
                                    item.score
                                  )} flex items-center justify-center text-white font-bold text-lg`}
                                >
                                  {item.score}
                                </div>
                                <span className="text-xs text-slate-400 mt-1 text-center">
                                  {getScoreText(item.score)}
                                </span>
                              </div>
                              {/* Slider */}
                              <div className="flex flex-col gap-1 pt-1">
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={item.score}
                                  onChange={(e) =>
                                    updateItemScore(item.id, parseInt(e.target.value))
                                  }
                                  className="w-28"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>1</span>
                                  <span>10</span>
                                </div>
                              </div>
                              {/* Prioritätsauswahl */}
                              <div className="flex flex-col items-center gap-1 pt-1">
                                <label className="text-xs text-slate-400">{t.priority}</label>
                                <select
                                  value={item.priority || ""}
                                  onChange={(e) =>
                                    updateItemPriority(
                                      item.id,
                                      e.target.value || null
                                    )
                                  }
                                  className="px-2 py-1 rounded text-white text-sm font-bold bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">-</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                                {item.priority && (
                                  <span className={`mt-1 px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                )}
                              </div>
                              {/* Team-Auswahl */}
                              <div className="flex flex-col gap-1 pt-1 min-w-[200px]">
                                <label className="text-xs text-slate-400">{t.responsibleTeams}</label>
                                <div className="flex flex-col gap-1">
                                  {availableTeams.map((team) => {
                                    const itemTeams = item.teams?.map((t) => t.team.id) || [];
                                    const isSelected = itemTeams.includes(team.id);
                                    return (
                                      <label
                                        key={team.id}
                                        className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white transition-colors"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const currentTeams = itemTeams;
                                            let newTeams: string[];
                                            if (e.target.checked) {
                                              newTeams = [...currentTeams, team.id];
                                            } else {
                                              newTeams = currentTeams.filter((id) => id !== team.id);
                                            }
                                            updateItemTeams(item.id, newTeams);
                                          }}
                                          className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-1"
                                        />
                                        <span>{team.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Verknüpfte KVPs - immer anzeigen für konsistentes Layout */}
                            <div className="mt-4 pt-4 border-t border-slate-700">
                              {kvpLinksMap[item.id] && kvpLinksMap[item.id].length > 0 ? (
                                <>
                                  <button
                                    onClick={() => toggleKvpExpansion(item.id)}
                                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <svg
                                      className={`w-4 h-4 transition-transform ${
                                        expandedKvpItems.includes(item.id) ? "rotate-90" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                    <span>
                                      {t.linkedKvps(kvpLinksMap[item.id].length)}
                                    </span>
                                  </button>

                                  {expandedKvpItems.includes(item.id) && (
                                    <div className="mt-3 space-y-2">
                                      {kvpLinksMap[item.id].map((link) => (
                                        <a
                                          key={link.linkId}
                                          href={`/ubs-kvp?search=${encodeURIComponent(link.kvp.focusKeyword)}`}
                                          className="block p-3 bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors group"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300 truncate">
                                                  {link.kvp.focusKeyword}
                                                </span>
                                                {link.kvp.category && (
                                                  <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                                    {link.kvp.category}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-xs text-slate-500 truncate block">
                                                {link.kvp.url}
                                              </span>
                                            </div>
                                            <svg
                                              className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                              />
                                            </svg>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-slate-500 italic">
                                  {t.noLinkedKvps}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ChangeLog & Vergleich */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => {
                  setShowChangeLog(!showChangeLog);
                  setShowComparison(false);
                  if (!showChangeLog && selectedMaturity) {
                    fetchChangeLog(selectedMaturity.id);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showChangeLog
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t.changeLog.title}
                </span>
              </button>
              <button
                onClick={() => {
                  setShowComparison(!showComparison);
                  setShowChangeLog(false);
                  if (!showComparison && selectedMaturity) {
                    setCompareTargetId(selectedMaturity.id);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showComparison
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {t.compare.title}
                </span>
              </button>
            </div>

            {/* ChangeLog Timeline */}
            {showChangeLog && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t.changeLog.title}</h3>
                {isLoadingChangeLog ? (
                  <div className="h-32 bg-slate-900 rounded-lg animate-pulse"></div>
                ) : changeLog.length === 0 ? (
                  <p className="text-slate-500 text-sm italic">{t.changeLog.empty}</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupChangeLogByDate(changeLog)).map(([dateKey, logs]) => (
                      <div key={dateKey}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-px flex-1 bg-slate-700"></div>
                          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{dateKey}</span>
                          <div className="h-px flex-1 bg-slate-700"></div>
                        </div>
                        <div className="space-y-2">
                          {logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                                log.action === "create" ? "bg-green-400" :
                                log.action === "delete" ? "bg-red-400" : "bg-blue-400"
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${getActionColor(log.action)}`}>
                                    {getActionLabel(log.action)}
                                  </span>
                                  {log.field && (
                                    <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                      {getFieldLabel(log.field)}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-500">
                                    {new Date(log.createdAt).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-300 mt-1">
                                  <span className="text-slate-400">{log.itemCategory && categoryLabel(log.itemCategory)}</span>
                                  {" → "}
                                  <span className="font-medium">{log.itemTitle && itemTitleLabel(log.itemTitle)}</span>
                                </p>
                                {log.action === "update" && log.oldValue !== null && log.newValue !== null && (
                                  <div className="flex items-center gap-2 mt-1.5 text-xs">
                                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded line-through">{log.oldValue || "–"}</span>
                                    <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded">{log.newValue || "–"}</span>
                                  </div>
                                )}
                                {log.action === "delete" && log.oldValue && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {t.changeLog.scoreWas((() => { try { return String(JSON.parse(log.oldValue).score); } catch { return "?"; } })())}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {changeLogTotal > changeLog.length && (
                      <p className="text-xs text-slate-500 text-center">
                        {t.changeLog.shownOf(changeLog.length, changeLogTotal)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Vergleichsansicht */}
            {showComparison && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">{t.compare.title}</h3>
                <div className="flex flex-wrap items-end gap-4 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.compare.base}</label>
                    <select
                      value={compareBaseId}
                      onChange={(e) => { setCompareBaseId(e.target.value); setComparisonResult(null); }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                    >
                      <option value="">{t.compare.selectAnalysis}</option>
                      {maturities.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center pb-2">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.compare.target}</label>
                    <select
                      value={compareTargetId}
                      onChange={(e) => { setCompareTargetId(e.target.value); setComparisonResult(null); }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                    >
                      <option value="">{t.compare.selectAnalysis}</option>
                      {maturities.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={runComparison}
                    disabled={isComparing || !compareBaseId || !compareTargetId || compareBaseId === compareTargetId}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                  >
                    {isComparing ? t.compare.comparing : t.compare.compare}
                  </button>
                </div>

                {comparisonResult && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-white">{comparisonResult.summary.avgScoreDiff >= 0 ? "+" : ""}{comparisonResult.summary.avgScoreDiff.toFixed(2)}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.compare.avgScoreDiff}</div>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 border border-green-800/50 text-center">
                        <div className="text-2xl font-bold text-green-400">{comparisonResult.summary.added}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.compare.types.added}</div>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 border border-red-800/50 text-center">
                        <div className="text-2xl font-bold text-red-400">{comparisonResult.summary.removed}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.compare.types.removed}</div>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 border border-blue-800/50 text-center">
                        <div className="text-2xl font-bold text-blue-400">{comparisonResult.summary.changed}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.compare.types.changed}</div>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-center">
                        <div className="text-2xl font-bold text-slate-400">{comparisonResult.summary.unchanged}</div>
                        <div className="text-xs text-slate-400 mt-1">{t.compare.types.unchanged}</div>
                      </div>
                    </div>

                    {/* Score Comparison Header */}
                    <div className="flex items-center justify-between bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <div className="text-center">
                        <div className="text-sm text-slate-400">{comparisonResult.base.name}</div>
                        <div className="text-xl font-bold text-white">{comparisonResult.base.avgScore.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">{t.compare.items(comparisonResult.base.itemCount)}</div>
                      </div>
                      <div className="text-center px-4">
                        <div className={`text-3xl font-bold ${comparisonResult.summary.avgScoreDiff > 0 ? "text-green-400" : comparisonResult.summary.avgScoreDiff < 0 ? "text-red-400" : "text-slate-400"}`}>
                          {comparisonResult.summary.avgScoreDiff > 0 ? "+" : ""}{comparisonResult.summary.avgScoreDiff.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">{t.compare.change}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-slate-400">{comparisonResult.target.name}</div>
                        <div className="text-xl font-bold text-white">{comparisonResult.target.avgScore.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">{t.compare.items(comparisonResult.target.itemCount)}</div>
                      </div>
                    </div>

                    {/* Filter */}
                    <div className="flex flex-wrap gap-2">
                      {(["all", "changed", "added", "removed", "unchanged"] as const).map((type) => {
                        const count = type === "all"
                          ? comparisonResult.differences.length
                          : comparisonResult.differences.filter((d) => d.type === type).length;
                        return (
                          <button
                            key={type}
                            onClick={() => setCompareFilterType(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              compareFilterType === type
                                ? "bg-blue-600 text-white"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {t.compare.types[type]} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Diff-Tabelle */}
                    <div className="space-y-2">
                      {comparisonResult.differences
                        .filter((d) => compareFilterType === "all" || d.type === compareFilterType)
                        .map((diff, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-4 p-3 rounded-lg border ${
                              diff.type === "added" ? "bg-green-500/5 border-green-800/30" :
                              diff.type === "removed" ? "bg-red-500/5 border-red-800/30" :
                              diff.type === "changed" ? "bg-blue-500/5 border-blue-800/30" :
                              "bg-slate-900 border-slate-700"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              diff.type === "added" ? "bg-green-400" :
                              diff.type === "removed" ? "bg-red-400" :
                              diff.type === "changed" ? "bg-blue-400" : "bg-slate-500"
                            }`}></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{categoryLabel(diff.category)}</span>
                              </div>
                              <p className={`text-sm font-medium ${diff.type === "removed" ? "text-red-300 line-through" : "text-white"}`}>
                                {itemTitleLabel(diff.title)}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {diff.baseScore !== undefined && (
                                <div className="text-center">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                    (diff.baseScore || 0) <= 3 ? "bg-red-500" : (diff.baseScore || 0) <= 5 ? "bg-orange-500" : (diff.baseScore || 0) <= 7 ? "bg-blue-500" : "bg-green-500"
                                  }`}>
                                    {diff.baseScore}
                                  </div>
                                </div>
                              )}
                              {diff.type === "changed" && diff.scoreDiff !== undefined && diff.scoreDiff !== 0 && (
                                <span className={`text-sm font-bold ${diff.scoreDiff > 0 ? "text-green-400" : "text-red-400"}`}>
                                  {diff.scoreDiff > 0 ? "+" : ""}{diff.scoreDiff}
                                </span>
                              )}
                              {diff.targetScore !== undefined && (
                                <div className="text-center">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                    (diff.targetScore || 0) <= 3 ? "bg-red-500" : (diff.targetScore || 0) <= 5 ? "bg-orange-500" : (diff.targetScore || 0) <= 7 ? "bg-blue-500" : "bg-green-500"
                                  }`}>
                                    {diff.targetScore}
                                  </div>
                                </div>
                              )}
                              {diff.type === "added" && (
                                <span className="text-xs text-green-400 font-medium">{t.compare.newBadge}</span>
                              )}
                              {diff.type === "removed" && (
                                <span className="text-xs text-red-400 font-medium">{t.compare.removedBadge}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            {maturities.length === 0
              ? t.emptyFirst
              : t.emptySelect}
          </p>
        </div>
      )}
    </div>
  );
}
