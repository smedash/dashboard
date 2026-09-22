"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { hasFullAdminRights } from "@/lib/rbac";
import {
  CONTENT_CATEGORIES,
  CONTENT_LOCATIONS,
  CONTENT_LANGUAGES,
  FUNNEL_OPTIONS,
  ZIELGRUPPEN,
  journeyPhaseToFunnel,
  slugify,
} from "@/lib/content-workflow";

interface SavedArticle {
  id: string;
  title: string;
  slug: string;
  funnelStage: string;
  category: string;
  targetAudience: string;
  wordCount: number;
  createdAt: string;
  creator: { name: string | null; email: string };
}

export default function ContentPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!hasFullAdminRights(session?.user?.role)) {
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [funnelStage, setFunnelStage] = useState(
    searchParams.get("funnel") || journeyPhaseToFunnel(searchParams.get("journeyPhase"))
  );
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "Guide");
  const [language, setLanguage] = useState(searchParams.get("language") || "de");
  const [targetAudiences, setTargetAudiences] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [editorialPlanArticleId] = useState(searchParams.get("editorialPlanArticleId") || "");
  const [fromRedaktionsplan] = useState(!!searchParams.get("editorialPlanArticleId"));
  const [editorialDescription] = useState(searchParams.get("description") || "");

  const [isGenerating, setIsGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null);

  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [showArticles, setShowArticles] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const extractMeta = useCallback((html: string) => {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    setMetaTitle(titleMatch ? titleMatch[1].trim() : "");
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
    setMetaDescription(descMatch ? descMatch[1].trim() : "");
  }, []);

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true);
    try {
      const res = await fetch("/api/articles");
      if (res.ok) {
        setArticles(await res.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  const handleGenerate = async () => {
    if (!title || !funnelStage || !category || targetAudiences.length === 0) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }

    setError("");
    setHtmlContent("");
    setMetaTitle("");
    setMetaDescription("");
    setIsGenerating(true);
    setSavedMessage("");
    setSavedArticleId(null);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          funnelStage,
          category,
          location,
          language,
          targetAudience: targetAudiences.join(", "),
          ...(editorialDescription ? { description: editorialDescription } : {}),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler bei der Generierung");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Stream nicht verfügbar");
        setIsGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              const cleaned = accumulated.replace(/^```html\s*\n?/, "").replace(/\n?```\s*$/, "");
              setHtmlContent(cleaned);
            }
            if (parsed.error) setError(parsed.error);
          } catch {
            // Skip
          }
        }
      }

      extractMeta(accumulated.replace(/^```html\s*\n?/, "").replace(/\n?```\s*$/, ""));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Verbindungsfehler: " + String(err));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!htmlContent) return;
    setIsSaving(true);
    setSavedMessage("");

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          funnelStage,
          category,
          location,
          language,
          targetAudience: targetAudiences.join(", "),
          htmlContent,
          metaTitle: metaTitle || undefined,
          metaDescription: metaDescription || undefined,
          editorialPlanArticleId: editorialPlanArticleId || undefined,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setSavedArticleId(saved.id);
        setSavedMessage(
          fromRedaktionsplan
            ? "Artikel gespeichert und mit Redaktionsplan verknüpft. Weiter zum Content-Check zur Freigabe."
            : "Artikel gespeichert"
        );
        if (showArticles) loadArticles();
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
      }
    } catch {
      setError("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title) || "artikel"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleAudience = (value: string) => {
    setTargetAudiences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <div className="space-y-6">
      {fromRedaktionsplan && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
              Aus Redaktionsplan übernommen
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
              Titel, Kategorie und Funnel wurden vorausgefüllt. Wähle die Zielgruppe und starte die Generierung.
            </p>
          </div>
          <a href="/redaktionsplan" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
            Zurück zum Plan
          </a>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contentproduktion</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            SEO-optimierte Artikel per KI erstellen und als Entwurf im Content-Check speichern
          </p>
        </div>
        <button
          onClick={() => {
            if (!showArticles) loadArticles();
            setShowArticles(!showArticles);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {showArticles ? "Archiv ausblenden" : "Archiv anzeigen"}
        </button>
      </div>

      {showArticles && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loadingArticles ? (
            <div className="p-6 text-center text-slate-500">Lade Artikel…</div>
          ) : articles.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Noch keine Artikel gespeichert.</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {articles.map((article) => (
                <div key={article.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">{article.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {article.category} · {article.funnelStage} · {article.wordCount} Wörter
                    </p>
                  </div>
                  <a
                    href={`/content-check?article=${article.id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Zum Check
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Artikel-Parameter</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              placeholder="Artikeltitel"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="">Bitte wählen</option>
                {CONTENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                {CONTENT_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Funnel</label>
              <select
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="">Bitte wählen</option>
                {FUNNEL_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprache</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                {CONTENT_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Zielgruppe</label>
            <div className="flex flex-wrap gap-2">
              {ZIELGRUPPEN.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => toggleAudience(z)}
                  className={`px-3 py-1.5 text-xs rounded-full border ${
                    targetAudiences.includes(z)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {z}
                </button>
              ))}
              {showCustomInput ? (
                <input
                  value={customAudience}
                  onChange={(e) => setCustomAudience(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customAudience.trim()) {
                      toggleAudience(customAudience.trim());
                      setCustomAudience("");
                      setShowCustomInput(false);
                    }
                  }}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                  placeholder="Eigene Zielgruppe"
                  autoFocus
                />
              ) : (
                <button type="button" onClick={() => setShowCustomInput(true)} className="px-3 py-1.5 text-xs rounded-full border border-dashed border-slate-300 text-slate-500">
                  + Eigene
                </button>
              )}
            </div>
          </div>

          {editorialDescription && (
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              Briefing: {editorialDescription}
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {savedMessage && (
            <div className="text-sm text-green-700 dark:text-green-400">
              {savedMessage}{" "}
              {savedArticleId && (
                <a href={`/content-check?article=${savedArticleId}`} className="underline font-medium">
                  Content-Check öffnen
                </a>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm"
              >
                Abbrechen
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Generieren
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!htmlContent || isSaving || isGenerating}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? "Speichert…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!htmlContent}
              className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50"
            >
              HTML
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[480px]">
          {isGenerating && !htmlContent && (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">Generiere Artikel…</div>
          )}
          {htmlContent ? (
            <iframe
              title="Vorschau"
              srcDoc={htmlContent}
              className="w-full h-[calc(100vh-12rem)] min-h-[480px] bg-white"
              sandbox="allow-same-origin"
            />
          ) : (
            !isGenerating && (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Die Vorschau erscheint nach der Generierung.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
