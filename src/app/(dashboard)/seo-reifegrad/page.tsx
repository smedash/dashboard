"use client";

import { useState, useEffect } from "react";
import { SunburstChart } from "@/components/charts/SunburstChart";

interface SEOMaturityItem {
  id: string;
  category: string;
  title: string;
  description?: string;
  score: number;
  priority?: string | null; // A, B, C, D
  order: number;
}

interface SEOMaturity {
  id: string;
  name: string;
  description?: string;
  items: SEOMaturityItem[];
  createdAt: string;
  updatedAt: string;
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

  useEffect(() => {
    fetchMaturities();
  }, []);

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
        setSelectedMaturity(translatedMaturities[0]);
      }
    } catch (error) {
      console.error("Error fetching maturities:", error);
    } finally {
      setIsLoading(false);
    }
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
      alert("Fehler beim Erstellen der Analyse");
    } finally {
      setIsSaving(false);
    }
  };

  const updateItemScore = async (itemId: string, score: number) => {
    if (!selectedMaturity) return;

    try {
      const response = await fetch(
        `/api/seo-maturity/${selectedMaturity.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score }),
        }
      );

      const data = await response.json();
      if (data.item) {
        const updatedItems = selectedMaturity.items.map((item) =>
          item.id === itemId ? { ...item, score: data.item.score } : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
      }
    } catch (error) {
      console.error("Error updating item score:", error);
    }
  };

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
          item.id === itemId ? { ...item, priority: data.item.priority } : item
        );
        setSelectedMaturity({ ...selectedMaturity, items: updatedItems });
      }
    } catch (error) {
      console.error("Error updating item priority:", error);
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
      alert("Fehler beim Speichern der Beschreibung");
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
        setShowAddItemForm(null);
        setNewItemCategory("");
        setNewItemTitle("");
        setNewItemDescription("");
        setNewItemScore(1);
      }
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Fehler beim Hinzufügen des Punktes");
    } finally {
      setIsAddingItem(false);
    }
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
    if (score <= 3) return "Unausgereift";
    if (score <= 5) return "Wenig ausgereift";
    if (score <= 7) return "Ausgereift";
    return "Vollständig ausgereift";
  };

  const getPriorityColor = (priority: string | null | undefined): string => {
    if (!priority) return "bg-slate-600";
    switch (priority.toUpperCase()) {
      case "A":
        return "bg-red-600";
      case "B":
        return "bg-orange-600";
      case "C":
        return "bg-yellow-600";
      case "D":
        return "bg-green-600";
      default:
        return "bg-slate-600";
    }
  };

  // SEO-Erklärungen für jeden Punkt
  const getSEOExplanation = (title: string): string => {
    const explanations: Record<string, string> = {
      "Google Analytics prüfen und einrichten": "Google Analytics ermöglicht es, das Nutzerverhalten zu verstehen und SEO-Maßnahmen datenbasiert zu optimieren. Ohne Analytics fehlt die Grundlage für fundierte SEO-Entscheidungen.",
      "Google Search Console (GSC) prüfen und einrichten": "Die Search Console zeigt, wie Google Ihre Website sieht. Sie erhalten Einblicke in Indexierungsprobleme, Suchanfragen und Klickraten, die essentiell für SEO-Optimierungen sind.",
      "SEO-Lösung für die Website prüfen und installieren": "Eine professionelle SEO-Lösung automatisiert viele technische SEO-Aufgaben und hilft dabei, Fehler frühzeitig zu erkennen und zu beheben.",
      "Uptime-Monitoring einrichten": "Wenn Ihre Website häufig nicht erreichbar ist, wirkt sich das negativ auf Rankings aus. Uptime-Monitoring stellt sicher, dass Ausfälle schnell erkannt werden.",
      "Prüfen auf Impressum, Kontakt, Datenschutz und AGB-Seiten": "Diese Seiten sind rechtlich erforderlich und erhöhen das Vertrauen bei Nutzern und Suchmaschinen. Fehlende Seiten können zu rechtlichen Problemen führen.",
      "Keyword-Ranking-Tracking einrichten": "Ohne Tracking wissen Sie nicht, ob Ihre SEO-Maßnahmen erfolgreich sind. Ranking-Tracking zeigt Fortschritte und hilft bei der Priorisierung.",
      "Prüfen auf benutzerfreundliche Permalinks": "Klare, beschreibende URLs verbessern die Nutzererfahrung und helfen Suchmaschinen, den Inhalt zu verstehen. Sie sind ein wichtiger Ranking-Faktor.",
      "Prüfen ob die Website mobilfreundlich ist": "Seit 2015 ist Mobile-First ein wichtiger Ranking-Faktor. Die Mehrheit der Nutzer surft mobil - eine nicht mobile-optimierte Website verliert massiv an Rankings.",
      "Prüfen ob die Website schnell lädt": "Ladezeiten sind ein direkter Ranking-Faktor. Langsame Seiten führen zu höheren Absprungraten und schlechteren Rankings.",
      "URLs kurz halten": "Kurze URLs sind benutzerfreundlicher, einfacher zu teilen und werden von Suchmaschinen bevorzugt. Sie verbessern die Klickrate in den Suchergebnissen.",
      "404-Seite prüfen und optimieren": "Eine gute 404-Seite hilft Nutzern, auf der Website zu bleiben, und reduziert die Absprungrate. Sie sollte Navigation und Suchfunktion bieten.",
      "Content einfach teilbar machen": "Social Sharing erhöht die Sichtbarkeit und kann indirekt Rankings beeinflussen. Teilbare Inhalte erhalten mehr Backlinks und Traffic.",
      "Marke auf mehreren Social-Media-Plattformen beanspruchen": "Social Signals sind zwar kein direkter Ranking-Faktor, aber sie erhöhen die Markensichtbarkeit und können zu mehr Traffic und Backlinks führen.",
      "Heatmaps verwenden um zu sehen was Nutzer tatsächlich sehen": "Heatmaps zeigen, wie Nutzer mit Ihrer Website interagieren. Diese Erkenntnisse helfen dabei, Conversion-Rate und Nutzererfahrung zu optimieren.",
      "Leistungsstarken Webhost verwenden": "Ein schneller, zuverlässiger Host ist die Grundlage für gute Performance. Schlechte Hosting-Qualität kann Rankings erheblich beeinträchtigen.",
      "Prüfen ob der Server nahe am Servicegebiet liegt": "Die geografische Nähe des Servers zum Zielpublikum reduziert Latenzzeiten und verbessert die Ladegeschwindigkeit, was Rankings positiv beeinflusst.",
      "CDN verwenden": "Ein Content Delivery Network beschleunigt die Auslieferung Ihrer Website weltweit und verbessert Ladezeiten erheblich - ein wichtiger Ranking-Faktor.",
      "Prüfen auf GZIP-Komprimierung": "GZIP reduziert die Dateigröße um bis zu 70%, was die Ladezeiten deutlich verbessert. Dies ist ein einfacher, aber effektiver Performance-Boost.",
      "Prüfen auf HTTP/2": "HTTP/2 ermöglicht Multiplexing und Header-Komprimierung, was die Performance deutlich verbessert. Moderne Websites sollten HTTP/2 verwenden.",
      "Caching-Lösung verwenden": "Caching reduziert Server-Last und verbessert Ladezeiten erheblich. Es ist eine der effektivsten Methoden zur Performance-Optimierung.",
      "JS/CSS-Dateien minifizieren": "Minifizierung reduziert die Dateigröße und verbessert Ladezeiten. Jede Millisekunde zählt für Rankings und Nutzererfahrung.",
      "Große Bilder beim Upload anpassen": "Zu große Bilder verlangsamen die Website erheblich. Die richtige Bildgröße ist essentiell für gute Performance.",
      "Bilder komprimieren und optimieren": "Optimierte Bilder reduzieren die Ladezeit erheblich, ohne sichtbare Qualitätsverluste. Dies verbessert Rankings und Nutzererfahrung.",
      "Lazy Loading für Bilder & Iframes (YouTube-Einbettungen, etc.)": "Lazy Loading verbessert die initiale Ladezeit, da Bilder erst geladen werden, wenn sie benötigt werden. Dies ist besonders wichtig für mobile Nutzer.",
      "Technologie aktualisieren": "Veraltete Technologien sind oft langsamer und unsicherer. Aktuelle Technologien bieten bessere Performance und Sicherheit.",
      "Datenbank optimieren": "Eine optimierte Datenbank reduziert Query-Zeiten und verbessert die Gesamtperformance der Website erheblich.",
      "Prüfen auf HTTPS": "HTTPS ist seit 2014 ein Ranking-Faktor. Nicht-verschlüsselte Websites werden von Google abgewertet und Nutzer sehen Warnungen.",
      "Prüfen auf eine einzige www-Version": "Doppelte Versionen (www und non-www) können zu Duplicate-Content-Problemen führen. Eine kanonische Version ist essentiell.",
      "Mixed Content beheben": "Mixed Content (HTTP-Ressourcen auf HTTPS-Seiten) kann Sicherheitswarnungen auslösen und das Vertrauen der Nutzer beeinträchtigen.",
      "Sitemap erstellen und zu Google Search Console (GSC) hinzufügen": "Eine Sitemap hilft Google, alle Seiten Ihrer Website zu finden und zu indexieren. Sie ist besonders wichtig für große Websites.",
      "robots.txt-Datei erstellen": "Die robots.txt steuert, welche Bereiche der Website von Suchmaschinen gecrawlt werden dürfen. Falsche Konfiguration kann zu Indexierungsproblemen führen.",
      "Prüfen ob URLs Redirects zu / haben oder Canonical auf / gesetzt ist": "Kanonische URLs verhindern Duplicate-Content-Probleme und stellen sicher, dass der Linkjuice korrekt verteilt wird.",
      "Defekte Links prüfen und beheben": "Defekte Links verschlechtern die Nutzererfahrung und können zu Ranking-Verlusten führen. Sie zeigen Suchmaschinen auch, dass die Website nicht gepflegt wird.",
      "Redirect-Ketten prüfen und beheben": "Lange Redirect-Ketten verlangsamen die Website und können zu Ranking-Verlusten führen. Direkte Redirects sind optimal.",
      "Fehlende und doppelte Meta-Titles und -Descriptions beheben": "Meta-Tags sind wichtig für Klickraten in den Suchergebnissen. Fehlende oder doppelte Tags können Rankings beeinträchtigen.",
      "Redirects korrekt verwenden": "Richtige Redirects (301 für permanente, 302 für temporäre) erhalten Linkjuice und verhindern Ranking-Verluste beim Umzug von Seiten.",
      "Prüfen auf Index-Abdeckungsprobleme": "Indexierungsprobleme bedeuten, dass Seiten nicht in den Suchergebnissen erscheinen. Dies muss regelmäßig überwacht werden.",
      "Prüfen auf manuelle Penalties": "Manuelle Penalties von Google können zu massiven Ranking-Verlusten führen. Sie müssen in der Search Console überwacht werden.",
      "Seiten maximal 3 Klicks von der Startseite entfernt halten": "Flache Site-Struktur hilft Suchmaschinen, alle Seiten zu finden und zu indexieren. Tiefe Hierarchien können zu Indexierungsproblemen führen.",
      "\"noindex\" und \"nofollow\" Tags korrekt verwenden": "Diese Tags steuern die Indexierung und Linkwert-Weitergabe. Falsche Verwendung kann zu Ranking-Problemen führen.",
      "Irrelevante Seiten von der Indexierung ausschließen": "Irrelevante Seiten können den Crawl-Budget verschwenden und die Indexierung wichtiger Seiten verzögern.",
      "Solide SEO-Content-Strategie haben": "Ohne Strategie ist Content-Erstellung ineffizient. Eine klare Strategie stellt sicher, dass Content SEO-Ziele unterstützt.",
      "Keyword-Recherche durchführen": "Keyword-Recherche zeigt, wonach Nutzer suchen. Sie ist die Grundlage für erfolgreiche SEO-Content-Erstellung.",
      "Langform-Content erstellen": "Längere Inhalte ranken tendenziell besser, da sie Themen umfassend abdecken und mehr Backlinks erhalten. Sie zeigen Expertise.",
      "10x Content erstellen": "10x Content ist deutlich besser als bestehende Inhalte. Solche Inhalte erhalten mehr Backlinks, Shares und Rankings.",
      "Keyword-Kannibalisierung identifizieren und beheben": "Wenn mehrere Seiten für dasselbe Keyword ranken, konkurrieren sie miteinander. Dies schwächt die Rankings aller betroffenen Seiten.",
      "Doppelten Content identifizieren und beheben": "Duplicate Content kann zu Ranking-Verlusten führen, da Google nicht weiß, welche Version ranken soll. Er muss konsolidiert werden.",
      "Content-Hubs erstellen": "Content-Hubs organisieren verwandte Inhalte und zeigen Suchmaschinen die Themenkompetenz. Sie verbessern Rankings für alle enthaltenen Seiten.",
      "Hubs mit unterstützendem Content \"füttern\"": "Regelmäßig neuer Content in Hubs stärkt die Themenkompetenz und hält die Inhalte aktuell, was Rankings verbessert.",
      "Content regelmäßig aktualisieren": "Aktualisierter Content signalisiert Google, dass die Website aktiv gepflegt wird. Frische Inhalte ranken tendenziell besser.",
      "Content zu Kategorien hinzufügen": "Kategorien mit Inhalten zeigen Themenkompetenz und helfen Nutzern und Suchmaschinen, die Website-Struktur zu verstehen.",
      "E-A-T aufbauen": "Expertise, Authoritativeness und Trustworthiness sind wichtige Ranking-Faktoren. Sie zeigen, dass Ihre Website vertrauenswürdig ist.",
      "Für Menschen schreiben, nicht für Suchmaschinen": "Google bevorzugt natürlichen, nutzerfreundlichen Content. Überoptimierung kann zu Penalties führen.",
      "Prüfen ob das Ziel-Keyword der Nutzerabsicht entspricht": "Wenn Content nicht die Nutzerabsicht erfüllt, sinkt die Klickrate und die Rankings fallen. Intent-Matching ist entscheidend.",
      "Ziel-Keyword in URL, Title und Überschrift haben": "Keywords in wichtigen Elementen helfen Suchmaschinen, den Inhalt zu verstehen. Dies ist ein wichtiger Ranking-Faktor.",
      "Fokus-Keyword im ersten Absatz verwenden": "Das Keyword im ersten Absatz signalisiert Suchmaschinen sofort die Relevanz der Seite für die Suchanfrage.",
      "Ein einzelnes H1 pro Seite verwenden": "Ein H1 hilft Suchmaschinen, die Hauptüberschrift zu identifizieren. Mehrere H1s können zu Verwirrung führen.",
      "Ansprechenden, aber SEO-orientierten Meta-Title setzen": "Der Title ist wichtig für Klickraten in den Suchergebnissen. Er sollte ansprechend sein, aber auch relevante Keywords enthalten.",
      "Überzeugende Meta-Description schreiben": "Die Description beeinflusst die Klickrate in den Suchergebnissen. Eine gute Description kann Rankings indirekt verbessern.",
      "Unterüberschriften für Content-Hierarchie verwenden": "Strukturierte Überschriften helfen Suchmaschinen, den Inhalt zu verstehen und können für Featured Snippets verwendet werden.",
      "Content korrekt formatieren und stylen": "Gut formatierter Content verbessert die Lesbarkeit und Nutzererfahrung, was zu besseren Rankings führt.",
      "Zu relevanten internen Seiten verlinken": "Interne Verlinkung verteilt Linkjuice und hilft Suchmaschinen, die Website-Struktur zu verstehen. Sie ist essentiell für SEO.",
      "Zu relevanten, autoritativen Websites verlinken": "Outbound-Links zu hochwertigen Quellen zeigen Expertise und können das Vertrauen in Ihre Inhalte erhöhen.",
      "Nie zu einer Seite/Website mit demselben Anchor-Text verlinken, den die aktuelle Seite verwendet": "Dies kann zu Keyword-Kannibalisierung führen. Verschiedene Anchor-Texte sind natürlicher und effektiver.",
      "Bilder korrekt benennen": "Bildnamen mit Keywords helfen Suchmaschinen, Bilder zu verstehen und können zu Image-Search-Rankings führen.",
      "Alt-Texte für Bilder setzen": "Alt-Texte sind wichtig für Barrierefreiheit und helfen Suchmaschinen, Bilder zu verstehen. Sie können zu Image-Search-Rankings führen.",
      "Prüfen auf Social-Markup": "Social-Markup (Open Graph, Twitter Cards) verbessert die Darstellung beim Teilen in Social Media und kann indirekt Rankings beeinflussen.",
      "Dwell Time prüfen und optimieren": "Dwell Time zeigt, wie lange Nutzer auf Ihrer Seite bleiben. Hohe Dwell Time signalisiert Google, dass der Content relevant ist.",
      "Auf Featured Snippet abzielen": "Featured Snippets bringen mehr Traffic und erhöhen die Sichtbarkeit. Strukturierter Content erhöht die Chancen darauf.",
      "Nicht überoptimieren": "Überoptimierung kann zu Penalties führen. Natürlicher Content rankt besser als überoptimierter.",
      "Solide Linkbuilding-Strategie haben": "Backlinks sind ein wichtiger Ranking-Faktor. Eine Strategie stellt sicher, dass Links gezielt und hochwertig sind.",
      "Grundlegende Links aufbauen": "Grundlegende Links (z.B. Branchenverzeichnisse) bilden die Basis für weiteres Linkbuilding und zeigen lokale Relevanz.",
      "Social-Media-Netzwerke verknüpfen": "Verknüpfte Social-Media-Profile erhöhen die Markensichtbarkeit und können zu mehr Traffic führen.",
      "Gastbeiträge auf nischenbezogenen Blogs veröffentlichen": "Gastbeiträge bringen hochwertige Backlinks und erhöhen die Markensichtbarkeit in der Nische.",
      "Partner um Links bitten, mit denen man zusammengearbeitet hat": "Partner-Links sind natürlicher und hochwertiger als gekaufte Links. Sie zeigen echte Beziehungen.",
      "Markenerwähnungen in Links umwandeln": "Unerwähnte Markenerwähnungen sind verpasste Chancen für Backlinks. Sie sollten aktiv in Links umgewandelt werden.",
      "Social Signals nutzen um Rankings zu steigern": "Während Social Signals kein direkter Ranking-Faktor sind, können sie zu mehr Traffic und Backlinks führen.",
      "Social-Media-Posts planen": "Regelmäßige Social-Media-Aktivitäten erhöhen die Sichtbarkeit und können zu mehr Traffic und Backlinks führen.",
      "Google My Business-Eintrag beanspruchen": "GMB ist essentiell für lokale Rankings. Ein optimierter Eintrag kann zu deutlich mehr lokalen Sichtbarkeiten führen.",
      "Yelp-Eintrag beanspruchen": "Yelp ist wichtig für lokale Sichtbarkeit, besonders in bestimmten Branchen. Ein optimierter Eintrag bringt mehr Kunden.",
      "Bing Places for Business-Eintrag beanspruchen": "Bing Places erhöht die Sichtbarkeit in Bing-Suchergebnissen und kann zusätzlichen Traffic bringen.",
      "Einträge optimieren": "Optimierte Einträge mit vollständigen Informationen, Bildern und Kategorien ranken besser in lokalen Suchergebnissen.",
      "In allgemeinen relevanten Verzeichnissen eintragen": "Verzeichniseinträge bringen Backlinks und erhöhen die lokale Sichtbarkeit. Sie sind wichtig für lokale SEO.",
      "In nischen-spezifischen Verzeichnissen eintragen": "Nischen-Verzeichnisse bringen hochwertigere, relevantere Backlinks als allgemeine Verzeichnisse.",
      "Auf Bewertungen antworten": "Antworten auf Bewertungen zeigen Engagement und können die lokalen Rankings verbessern. Sie zeigen auch anderen Nutzern, dass Sie kundenorientiert sind.",
      "Um Bewertungen bitten": "Mehr Bewertungen verbessern die lokalen Rankings und das Vertrauen potenzieller Kunden. Sie sind ein wichtiger Ranking-Faktor.",
      "Google Posts veröffentlichen": "Google Posts erhöhen die Sichtbarkeit in lokalen Suchergebnissen und zeigen aktive Präsenz. Sie können zu mehr Klicks führen.",
      "Prüfen auf siteweite NAP-Details (Name, Adresse, Telefon)": "Konsistente NAP-Daten auf der gesamten Website helfen Google, die lokale Relevanz zu verstehen.",
      "Konsistente NAP-Details auf der gesamten Website haben": "Inkonsistente NAP-Daten können zu Ranking-Verlusten führen. Konsistenz ist essentiell für lokale SEO.",
      "Konsistente NAP-Details in Einträgen & Social-Media-Netzwerken haben": "Konsistente NAP-Daten überall erhöhen das Vertrauen von Google und verbessern lokale Rankings.",
      "Content-Strategie für lokale Themen haben": "Lokaler Content zeigt Google die lokale Relevanz und kann zu besseren Rankings für lokale Suchanfragen führen.",
      "Markenerwähnungen von lokalen Websites beanspruchen": "Lokale Markenerwähnungen können in wertvolle Backlinks umgewandelt werden und zeigen lokale Relevanz.",
      "Local Business Markup zur Homepage hinzufügen": "Structured Data hilft Google, Ihre lokale Relevanz zu verstehen und kann zu Rich Snippets in den Suchergebnissen führen.",
    };
    return explanations[title] || "Dieser Punkt ist wichtig für die SEO-Performance Ihrer Website.";
  };

  const prepareSunburstData = () => {
    if (!selectedMaturity) return [];

    const categoryMap = new Map<string, SEOMaturityItem[]>();
    selectedMaturity.items.forEach((item) => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, []);
      }
      categoryMap.get(item.category)!.push(item);
    });

    return Array.from(categoryMap.entries()).map(([category, items]) => ({
      name: category,
      value: items.reduce((sum, item) => sum + item.score, 0) / items.length,
      score: items.reduce((sum, item) => sum + item.score, 0) / items.length,
      children: items.map((item) => ({
        name: item.title,
        value: item.score,
        score: item.score,
        priority: item.priority || null,
      })),
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-white">SEO Reifegrad</h1>
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">SEO Reifegrad</h1>
        <div className="flex gap-4">
          {maturities.length > 0 && (
            <select
              value={selectedMaturity?.id || ""}
              onChange={(e) => {
                const maturity = maturities.find((m) => m.id === e.target.value);
                setSelectedMaturity(maturity || null);
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
            {showNewForm ? "Abbrechen" : "Neue Analyse"}
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Neue SEO Reifegrad Analyse</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={newMaturityName}
                onChange={(e) => setNewMaturityName(e.target.value)}
                placeholder="z.B. Q1 2024"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beschreibung
              </label>
              <textarea
                value={newMaturityDescription}
                onChange={(e) => setNewMaturityDescription(e.target.value)}
                placeholder="Optionale Beschreibung"
                rows={3}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <button
              onClick={createNewMaturity}
              disabled={isSaving || !newMaturityName.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? "Erstelle..." : "Erstellen"}
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
              <h3 className="text-lg font-semibold text-white mb-4">Übersicht</h3>
              <div className="flex justify-center w-full overflow-x-auto">
                <SunburstChart data={prepareSunburstData()} width={1200} height={1200} />
              </div>
            </div>

            {/* Checkliste */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">Checkliste</h3>
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
                        🔍 Zu Kategorie springen...
                      </option>
                      {Array.from(new Set(selectedMaturity.items.map((item) => item.category)))
                        .sort()
                        .map((category) => (
                          <option key={category} value={category.replace(/\s+/g, "-")}>
                            {category}
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
                    Neuen Punkt hinzufügen
                  </button>
                </div>
              </div>

              {/* Formular zum Hinzufügen eines neuen Punktes */}
              {showAddItemForm === "new" && (
                <div className="bg-slate-900 rounded-lg border border-slate-700 p-4">
                  <h4 className="text-md font-semibold text-white mb-4">Neuen Punkt hinzufügen</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Kategorie *
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
                        <option value="">Kategorie auswählen...</option>
                        {getAvailableCategories().map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__new__">Neue Kategorie erstellen</option>
                      </select>
                      {newItemCategory === "__new__" && (
                        <input
                          type="text"
                          value={newItemCategoryInput}
                          onChange={(e) => setNewItemCategoryInput(e.target.value)}
                          placeholder="Neue Kategorie eingeben..."
                          className="w-full mt-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Titel *
                      </label>
                      <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        placeholder="Titel des Punktes..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Beschreibung (optional)
                      </label>
                      <textarea
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder="Beschreibung..."
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Initiale Bewertung: {newItemScore}
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
                        {isAddingItem ? "Hinzufügen..." : "Hinzufügen"}
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
                        Abbrechen
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
                      <h4 className="text-md font-semibold text-slate-300">{category}</h4>
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
                        Punkt hinzufügen
                      </button>
                    </div>

                    {/* Formular zum Hinzufügen eines Punktes zu einer Kategorie */}
                    {showAddItemForm === category && (
                      <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 mb-3">
                        <h5 className="text-sm font-semibold text-white mb-3">Neuen Punkt zu "{category}" hinzufügen</h5>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              Titel *
                            </label>
                            <input
                              type="text"
                              value={newItemTitle}
                              onChange={(e) => setNewItemTitle(e.target.value)}
                              placeholder="Titel des Punktes..."
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              Beschreibung (optional)
                            </label>
                            <textarea
                              value={newItemDescription}
                              onChange={(e) => setNewItemDescription(e.target.value)}
                              placeholder="Beschreibung..."
                              rows={2}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              Initiale Bewertung: {newItemScore}
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
                              {isAddingItem ? "Hinzufügen..." : "Hinzufügen"}
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
                              Abbrechen
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
                              <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-medium text-white">{item.title}</h5>
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
                                            Warum ist das wichtig für SEO?
                                          </h6>
                                          <p className="text-sm text-slate-300 leading-relaxed">
                                            {getSEOExplanation(item.title)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {editingDescription === item.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={descriptionText}
                                    onChange={(e) => setDescriptionText(e.target.value)}
                                    placeholder="Erklärungstext eingeben..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveDescription(item.id)}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                    >
                                      Speichern
                                    </button>
                                    <button
                                      onClick={cancelEditingDescription}
                                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                    >
                                      Abbrechen
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {item.description ? (
                                    <p className="text-sm text-slate-400">{item.description}</p>
                                  ) : (
                                    <p className="text-sm text-slate-500 italic">Keine Erklärung vorhanden</p>
                                  )}
                                  <button
                                    onClick={() => startEditingDescription(item.id, item.description)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    {item.description ? "Bearbeiten" : "Erklärung hinzufügen"}
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
                                <label className="text-xs text-slate-400">Priorität</label>
                                <select
                                  value={item.priority || ""}
                                  onChange={(e) =>
                                    updateItemPriority(
                                      item.id,
                                      e.target.value || null
                                    )
                                  }
                                  className={`px-2 py-1 rounded text-white text-sm font-bold ${getPriorityColor(
                                    item.priority
                                  )} border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                >
                                  <option value="">-</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            {maturities.length === 0
              ? "Erstelle deine erste SEO Reifegrad Analyse"
              : "Wähle eine Analyse aus oder erstelle eine neue"}
          </p>
        </div>
      )}
    </div>
  );
}
