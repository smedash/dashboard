"use client";

import { useState, useEffect } from "react";

interface KVPSubkeyword {
  id: string;
  keyword: string;
  createdAt: string;
  updatedAt: string;
}

interface KVPComment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface KVPUrl {
  id: string;
  url: string;
  focusKeyword: string;
  category?: string | null;
  comment?: string | null; // Deprecated, wird durch comments ersetzt
  subkeywords: KVPSubkeyword[];
  comments: KVPComment[];
  createdAt: string;
  updatedAt: string;
}

const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

interface Ranking {
  keyword: string;
  position: number | null;
  url: string | null;
  date: string;
}

// Funktion zum Formatieren von Datum und Uhrzeit
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function UBSKVPPage() {
  const [urls, setUrls] = useState<KVPUrl[]>([]);
  const [rankings, setRankings] = useState<Record<string, Ranking[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newFocusKeyword, setNewFocusKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [newSubkeywords, setNewSubkeywords] = useState<string[]>([]);
  const [newSubkeywordInput, setNewSubkeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUrls();
  }, []);

  useEffect(() => {
    // Lade Rankings für alle URLs
    urls.forEach((url) => {
      fetchRankings(url.id);
    });
  }, [urls]);

  const fetchUrls = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/kvp");
      const data = await response.json();
      setUrls(data.urls || []);
    } catch (error) {
      console.error("Error fetching KVP URLs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRankings = async (urlId: string) => {
    try {
      const response = await fetch(`/api/kvp/${urlId}/rankings`);
      const data = await response.json();
      if (data.rankings) {
        setRankings((prev) => ({
          ...prev,
          [urlId]: data.rankings,
        }));
      }
    } catch (error) {
      console.error("Error fetching rankings:", error);
    }
  };

  const getRankingForKeyword = (urlId: string, keyword: string): Ranking | null => {
    const urlRankings = rankings[urlId] || [];
    return urlRankings.find((r) => r.keyword === keyword) || null;
  };

  const handleCreateUrl = async () => {
    if (!newUrl.trim() || !newFocusKeyword.trim()) {
      alert("URL und Fokuskeyword sind erforderlich");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/kvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          focusKeyword: newFocusKeyword.trim(),
          category: newCategory || null,
          comment: newComment.trim() || null,
          subkeywords: newSubkeywords.filter((k) => k.trim()),
        }),
      });

      const data = await response.json();
      if (data.url) {
        const newUrls = [data.url, ...urls];
        setUrls(newUrls);
        setShowNewForm(false);
        resetForm();
        // Lade Rankings für die neue URL
        await fetchRankings(data.url.id);
      }
    } catch (error) {
      console.error("Error creating KVP URL:", error);
      alert("Fehler beim Erstellen der URL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUrl = async (id: string, url: string, focusKeyword: string, category: string, comment: string) => {
    try {
      const response = await fetch(`/api/kvp/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          focusKeyword: focusKeyword.trim(),
          category: category || null,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Aktualisieren");
      }

      const data = await response.json();
      if (data.url) {
        setUrls(urls.map((u) => (u.id === id ? data.url : u)));
        setEditingId(null);
        // Lade Rankings neu, falls sich Keywords geändert haben
        await fetchRankings(id);
      } else {
        throw new Error("Keine Daten erhalten");
      }
    } catch (error) {
      console.error("Error updating KVP URL:", error);
      alert(`Fehler beim Aktualisieren der URL: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  };

  const handleDeleteUrl = async (id: string) => {
    if (!confirm("Möchten Sie diese URL wirklich löschen?")) {
      return;
    }

    try {
      const response = await fetch(`/api/kvp/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUrls(urls.filter((u) => u.id !== id));
      }
    } catch (error) {
      console.error("Error deleting KVP URL:", error);
      alert("Fehler beim Löschen der URL");
    }
  };

  const handleAddSubkeyword = async (urlId: string, keyword: string) => {
    if (!keyword.trim()) return;

    try {
      const response = await fetch(`/api/kvp/${urlId}/subkeywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();
      if (data.subkeyword) {
        const updatedUrls = urls.map((u) =>
          u.id === urlId
            ? { ...u, subkeywords: [...u.subkeywords, data.subkeyword] }
            : u
        );
        setUrls(updatedUrls);
        
        // Füge das neue Keyword auch zum Ranktracker hinzu
        const url = updatedUrls.find((u) => u.id === urlId);
        if (url) {
          await addKeywordToRankTracker(keyword.trim(), url.url);
          // Lade Rankings neu
          await fetchRankings(urlId);
        }
      }
    } catch (error) {
      console.error("Error adding subkeyword:", error);
      alert("Fehler beim Hinzufügen des Subkeywords");
    }
  };

  const addKeywordToRankTracker = async (keyword: string, targetUrl: string) => {
    try {
      const response = await fetch("/api/rank-tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          targetUrl: targetUrl.trim(),
        }),
      });

      if (!response.ok) {
        // Ignoriere Fehler wenn Keyword bereits existiert
        const error = await response.json();
        if (error.error !== "Keyword existiert bereits") {
          console.error("Error adding keyword to rank tracker:", error);
        }
      }
    } catch (error) {
      console.error("Error adding keyword to rank tracker:", error);
    }
  };

  const handleStartEditingComment = (urlId: string, currentComment?: string | null) => {
    if (currentComment) {
      // Bestehenden Kommentar bearbeiten
      setEditingCommentId(urlId);
    } else {
      // Neuen Kommentar hinzufügen
      setEditingCommentId(`new-${urlId}`);
    }
    setCommentText(currentComment || "");
  };

  const handleCancelEditingComment = () => {
    setEditingCommentId(null);
    setCommentText("");
  };

  const handleSaveComment = async (urlId: string, commentId?: string) => {
    try {
      if (commentId) {
        // Kommentar aktualisieren
        const response = await fetch(`/api/kvp/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: commentText.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error("Fehler beim Speichern");
        }

        const data = await response.json();
        if (data.comment) {
          setUrls(
            urls.map((u) =>
              u.id === urlId
                ? {
                    ...u,
                    comments: u.comments.map((c) =>
                      c.id === commentId ? data.comment : c
                    ),
                  }
                : u
            )
          );
          setEditingCommentId(null);
          setCommentText("");
        }
      } else {
        // Neuen Kommentar hinzufügen
        const text = newCommentText[urlId] || commentText;
        if (!text.trim()) return;

        const response = await fetch(`/api/kvp/${urlId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error("Fehler beim Speichern");
        }

        const data = await response.json();
        if (data.comment) {
          setUrls(
            urls.map((u) =>
              u.id === urlId
                ? { ...u, comments: [...u.comments, data.comment] }
                : u
            )
          );
          setNewCommentText({ ...newCommentText, [urlId]: "" });
          setCommentText("");
        }
      }
    } catch (error) {
      console.error("Error saving comment:", error);
      alert("Fehler beim Speichern des Kommentars");
    }
  };

  const handleDeleteComment = async (urlId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/kvp/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Löschen");
      }

      setUrls(
        urls.map((u) =>
          u.id === urlId
            ? { ...u, comments: u.comments.filter((c) => c.id !== commentId) }
            : u
        )
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Fehler beim Löschen des Kommentars");
    }
  };

  const handleDeleteSubkeyword = async (urlId: string, subkeywordId: string) => {
    try {
      const response = await fetch(`/api/kvp/subkeywords/${subkeywordId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUrls(
          urls.map((u) =>
            u.id === urlId
              ? {
                  ...u,
                  subkeywords: u.subkeywords.filter((s) => s.id !== subkeywordId),
                }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error deleting subkeyword:", error);
      alert("Fehler beim Löschen des Subkeywords");
    }
  };

  const resetForm = () => {
    setNewUrl("");
    setNewFocusKeyword("");
    setNewCategory("");
    setNewComment("");
    setNewSubkeywords([]);
    setNewSubkeywordInput("");
  };

  const addSubkeywordToForm = () => {
    if (newSubkeywordInput.trim()) {
      setNewSubkeywords([...newSubkeywords, newSubkeywordInput.trim()]);
      setNewSubkeywordInput("");
    }
  };

  const removeSubkeywordFromForm = (index: number) => {
    setNewSubkeywords(newSubkeywords.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-white">UBS KVP</h1>
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">UBS KVP</h1>
          <p className="text-slate-400 mt-1">
            Kontinuierlicher Verbesserungsprozess
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {showNewForm ? "Abbrechen" : "Neue URL hinzufügen"}
        </button>
      </div>

      {showNewForm && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Neue URL hinzufügen
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                URL *
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Fokuskeyword *
              </label>
              <input
                type="text"
                value={newFocusKeyword}
                onChange={(e) => setNewFocusKeyword(e.target.value)}
                placeholder="Hauptkeyword für diese URL"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kategorie
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value="">Keine Kategorie</option>
                {KEYWORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kommentar
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Optionale Notizen oder Kommentare..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Subkeywords
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newSubkeywordInput}
                  onChange={(e) => setNewSubkeywordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubkeywordToForm();
                    }
                  }}
                  placeholder="Subkeyword eingeben und Enter drücken"
                  className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
                <button
                  onClick={addSubkeywordToForm}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Hinzufügen
                </button>
              </div>
              {newSubkeywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSubkeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-700 text-white rounded-lg text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeSubkeywordFromForm(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleCreateUrl}
              disabled={isSaving || !newUrl.trim() || !newFocusKeyword.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? "Erstelle..." : "Erstellen"}
            </button>
          </div>
        </div>
      )}

      {urls.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            Noch keine URLs erfasst. Erstellen Sie Ihre erste URL.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {urls.map((url) => (
            <div
              key={url.id}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700"
            >
              {editingId === url.id ? (
                <EditUrlForm
                  url={urls.find((u) => u.id === url.id) || url}
                  onSave={(updatedUrl, focusKeyword, category, comment) => {
                    handleUpdateUrl(url.id, updatedUrl, focusKeyword, category, comment);
                  }}
                  onCancel={() => setEditingId(null)}
                  onAddSubkeyword={async (keyword) => {
                    await handleAddSubkeyword(url.id, keyword);
                    // Aktualisiere die URL-Liste, um die neuen Subkeywords zu zeigen
                    const updatedUrls = await fetch("/api/kvp").then((r) => r.json());
                    if (updatedUrls.urls) {
                      setUrls(updatedUrls.urls);
                      // Aktualisiere auch die Rankings
                      await fetchRankings(url.id);
                    }
                  }}
                  onDeleteSubkeyword={async (subkeywordId) => {
                    await handleDeleteSubkeyword(url.id, subkeywordId);
                    // Aktualisiere die URL-Liste
                    const updatedUrls = await fetch("/api/kvp").then((r) => r.json());
                    if (updatedUrls.urls) {
                      setUrls(updatedUrls.urls);
                      // Aktualisiere auch die Rankings
                      await fetchRankings(url.id);
                    }
                  }}
                />
              ) : (
                <>
                  <div className="relative mb-4">
                    {/* Datum und Icons oben */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          Erstellt: {formatDateTime(url.createdAt)}
                        </span>
                        {url.updatedAt !== url.createdAt && (
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            Aktualisiert: {formatDateTime(url.updatedAt)}
                          </span>
                        )}
                      </div>
                      {/* Edit und Delete Icons oben rechts */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(url.id)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Bearbeiten"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUrl(url.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Löschen"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Inhalt - volle Breite */}
                    <div>
                      <div className="mb-2">
                        <h3 className="text-lg font-semibold text-white break-all">
                          {url.url}
                        </h3>
                        {url.category && (
                          <span className="text-xs text-slate-400 mt-1 inline-block">
                            Kategorie: {url.category}
                          </span>
                        )}
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-400">
                            Kommentare ({url.comments?.length || 0})
                          </span>
                        </div>
                        
                        {/* Bestehende Kommentare */}
                        {url.comments && url.comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {url.comments.map((comment) => (
                              <div key={comment.id} className="p-3 bg-slate-900 rounded-lg">
                                {editingCommentId === comment.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      placeholder="Kommentar eingeben..."
                                      rows={3}
                                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveComment(url.id, comment.id)}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                      >
                                        Speichern
                                      </button>
                                      <button
                                        onClick={handleCancelEditingComment}
                                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                      >
                                        Abbrechen
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group">
                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                                      {comment.text}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-slate-500">
                                        {formatDateTime(comment.createdAt)}
                                      </span>
                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleStartEditingComment(url.id, comment.text)}
                                          className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                          Bearbeiten
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(url.id, comment.id)}
                                          className="text-xs text-red-400 hover:text-red-300"
                                        >
                                          Löschen
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Neuen Kommentar hinzufügen */}
                        {editingCommentId === `new-${url.id}` ? (
                          <div className="space-y-2">
                            <textarea
                              value={newCommentText[url.id] || ""}
                              onChange={(e) =>
                                setNewCommentText({
                                  ...newCommentText,
                                  [url.id]: e.target.value,
                                })
                              }
                              placeholder="Neuen Kommentar eingeben..."
                              rows={3}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveComment(url.id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                              >
                                Hinzufügen
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setNewCommentText({ ...newCommentText, [url.id]: "" });
                                }}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCommentId(`new-${url.id}`)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors"
                          >
                            + Neuen Kommentar hinzufügen
                          </button>
                        )}
                      </div>
                      <div className="mb-4">
                        <div className="space-y-0 border border-slate-700 rounded-lg overflow-hidden">
                          {/* Fokuskeyword - fett */}
                          <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-slate-700">
                            <span className="text-sm font-bold text-blue-400">
                              {url.focusKeyword}
                            </span>
                            {(() => {
                              const ranking = getRankingForKeyword(url.id, url.focusKeyword);
                              if (ranking) {
                                return (
                                  <span className={`text-xs px-2 py-1 rounded flex-shrink-0 w-12 text-center ${
                                    ranking.position === null 
                                      ? "bg-slate-700 text-slate-400" 
                                      : ranking.position <= 10 
                                      ? "bg-green-600 text-white" 
                                      : ranking.position <= 30 
                                      ? "bg-yellow-600 text-white" 
                                      : "bg-red-600 text-white"
                                  }`}>
                                    {ranking.position === null ? "N/A" : ranking.position}
                                  </span>
                                );
                              }
                              return <span className="w-12"></span>;
                            })()}
                          </div>
                          
                          {/* Subkeywords - eingerückt und normal */}
                          {url.subkeywords.length > 0 && (
                            <div className="divide-y divide-slate-700">
                              {url.subkeywords.map((subkeyword, index) => {
                                const ranking = getRankingForKeyword(url.id, subkeyword.keyword);
                                return (
                                  <div
                                    key={subkeyword.id}
                                    className="flex items-center justify-between gap-4 px-4 py-2 pl-6 group"
                                    title={`Hinzugefügt: ${formatDateTime(subkeyword.createdAt)}`}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-sm text-slate-300">
                                        {subkeyword.keyword}
                                      </span>
                                      <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        ({formatDateTime(subkeyword.createdAt)})
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteSubkeyword(url.id, subkeyword.id)
                                        }
                                        className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 w-12 text-center ${
                                      ranking && ranking.position !== null
                                        ? ranking.position <= 10 
                                          ? "bg-green-600 text-white" 
                                          : ranking.position <= 30 
                                          ? "bg-yellow-600 text-white" 
                                          : "bg-red-600 text-white"
                                        : "bg-slate-600 text-slate-300"
                                    }`}>
                                      {ranking ? (ranking.position === null ? "N/A" : ranking.position) : "-"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
                          <AddSubkeywordForm
                            urlId={url.id}
                            onAdd={(keyword) => handleAddSubkeyword(url.id, keyword)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditUrlForm({
  url,
  onSave,
  onCancel,
  onAddSubkeyword,
  onDeleteSubkeyword,
}: {
  url: KVPUrl;
  onSave: (url: string, focusKeyword: string, category: string, comment: string) => void;
  onCancel: () => void;
  onAddSubkeyword: (keyword: string) => Promise<void>;
  onDeleteSubkeyword: (subkeywordId: string) => Promise<void>;
}) {
  const [editUrl, setEditUrl] = useState(url.url);
  const [editFocusKeyword, setEditFocusKeyword] = useState(url.focusKeyword);
  const [editCategory, setEditCategory] = useState(url.category || "");
  const [editComment, setEditComment] = useState(url.comment || "");
  const [editSubkeywords, setEditSubkeywords] = useState<KVPSubkeyword[]>(url.subkeywords);
  const [newSubkeywordInput, setNewSubkeywordInput] = useState("");

  const handleAddSubkeyword = async () => {
    if (!newSubkeywordInput.trim()) return;
    try {
      await onAddSubkeyword(newSubkeywordInput.trim());
      // Lade Subkeywords neu - wird durch Parent-Komponente aktualisiert
      setNewSubkeywordInput("");
    } catch (error) {
      console.error("Error adding subkeyword:", error);
    }
  };

  const handleDeleteSubkeyword = async (subkeywordId: string) => {
    try {
      await onDeleteSubkeyword(subkeywordId);
      // Entferne aus lokaler Liste
      setEditSubkeywords(editSubkeywords.filter((s) => s.id !== subkeywordId));
    } catch (error) {
      console.error("Error deleting subkeyword:", error);
    }
  };

  // Aktualisiere Subkeywords wenn sich die URL ändert
  useEffect(() => {
    setEditSubkeywords(url.subkeywords);
  }, [url.subkeywords]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          URL *
        </label>
        <input
          type="url"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Fokuskeyword *
        </label>
        <input
          type="text"
          value={editFocusKeyword}
          onChange={(e) => setEditFocusKeyword(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Kategorie
        </label>
        <select
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
        >
          <option value="">Keine Kategorie</option>
          {KEYWORD_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Kommentar
        </label>
        <textarea
          value={editComment}
          onChange={(e) => setEditComment(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Keywords
        </label>
        <div className="space-y-2 mb-3">
          {/* Fokuskeyword - fett */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-400">
              {editFocusKeyword || "(Fokuskeyword wird oben eingegeben)"}
            </span>
          </div>
          
          {/* Subkeywords - eingerückt und normal */}
          {editSubkeywords.length > 0 && (
            <div className="pl-4 space-y-1">
              {editSubkeywords.map((subkeyword) => (
                <div
                  key={subkeyword.id}
                  className="flex items-center gap-2 group"
                >
                  <span className="text-sm text-slate-300">
                    {subkeyword.keyword}
                  </span>
                  <button
                    onClick={() => handleDeleteSubkeyword(subkeyword.id)}
                    className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubkeywordInput}
            onChange={(e) => setNewSubkeywordInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubkeyword();
              }
            }}
            placeholder="Subkeyword eingeben und Enter drücken"
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
          />
          <button
            onClick={handleAddSubkeyword}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Hinzufügen
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(editUrl, editFocusKeyword, editCategory, editComment)}
          disabled={!editUrl.trim() || !editFocusKeyword.trim()}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Speichern
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function AddSubkeywordForm({
  urlId,
  onAdd,
}: {
  urlId: string;
  onAdd: (keyword: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      onAdd(keyword);
      setKeyword("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Subkeyword..."
        className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
      />
      <button
        type="submit"
        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
      >
        Hinzufügen
      </button>
    </form>
  );
}
