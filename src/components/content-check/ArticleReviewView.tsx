"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  COMMENT_ROLES,
  NEXT_STATUS,
  REVIEW_STATUSES,
  STATUS_CONFIG,
  canTransitionStatus,
  defaultCommentRole,
  describeHistoryEntry,
  type CommentRole,
} from "@/lib/content-workflow";
import { formatReviewDueDateDe } from "@/lib/review-deadline";
import { downloadContentReviewPdf } from "@/lib/content-review-pdf";

export interface ReviewComment {
  id: string;
  selectedText: string;
  commentText: string;
  role: string;
  resolved: boolean;
  changeAndForward: boolean;
  recheckAfterRevision: boolean;
  author: { id: string; name: string | null; email: string };
  resolvedBy?: { id: string; name: string | null; email: string } | null;
  createdAt: string;
}

export interface ReviewArticle {
  id: string;
  title: string;
  slug: string;
  contentNumber?: number;
  funnelStage: string;
  category: string;
  location?: string | null;
  language?: string | null;
  targetAudience: string;
  htmlContent: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  wordCount: number;
  reviewStatus: string;
  revisionRequestedAt?: string | null;
  revisionRequestedBy?: string | null;
  reviewStepDueAt?: string | null;
  claimedAt?: string | null;
  claimedByUserId?: string | null;
  claimedByName?: string | null;
  pdfApprovedAt?: string | null;
  pdfApprovedBy?: string | null;
  createdAt?: string;
  comments?: ReviewComment[];
  statusHistory?: {
    id: string;
    fromStatus: string;
    toStatus: string;
    changedByEmail?: string;
    changedByName: string | null;
    comment: string | null;
    createdAt: string;
  }[];
  images?: {
    id: string;
    fileName: string;
    fileUrl: string;
    uploadedBy: { name: string | null; email: string };
  }[];
  creator?: { name: string | null; email: string };
}

export function ArticleReviewView({
  article,
  onBack,
  onUpdate,
  canEditContent,
  isAdmin,
  userId,
  userRole,
  onDelete,
}: {
  article: ReviewArticle;
  onBack: () => void;
  onUpdate: (a: ReviewArticle) => void;
  canEditContent: boolean;
  isAdmin: boolean;
  userId: string | undefined;
  userRole: string | undefined;
  onDelete: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentRole, setCommentRole] = useState<CommentRole>(defaultCommentRole(article.reviewStatus));
  const [changeAndForward, setChangeAndForward] = useState(false);
  const [recheckAfterRevision, setRecheckAfterRevision] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHtmlView, setIsHtmlView] = useState(false);
  const [htmlSource, setHtmlSource] = useState("");
  const [editHtml, setEditHtml] = useState(article.htmlContent);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pdfApprovalUpdating, setPdfApprovalUpdating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editHtmlRef = useRef(article.htmlContent);
  const styleBlocksRef = useRef("");
  const cleanedOriginalRef = useRef("");
  const saveTriggeredRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasOpenRevision = !!article.revisionRequestedAt;
  const unresolved = (article.comments || []).filter((c) => !c.resolved);
  const nextAction = NEXT_STATUS[article.reviewStatus];
  const canForward = canTransitionStatus(userRole, article.reviewStatus);
  const statusConfig = STATUS_CONFIG[article.reviewStatus] || STATUS_CONFIG.draft;
  const currentStepIndex = REVIEW_STATUSES.indexOf(article.reviewStatus as (typeof REVIEW_STATUSES)[number]);
  const showPdfActions = article.reviewStatus === "approved" || article.reviewStatus === "published";
  const canDownloadPdf = canEditContent || !!article.pdfApprovedAt;
  const history = article.statusHistory || [];

  useEffect(() => {
    setCommentRole(defaultCommentRole(article.reviewStatus));
  }, [article.reviewStatus]);

  useEffect(() => {
    const styleMatches = article.htmlContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    styleBlocksRef.current = styleMatches ? styleMatches.join("\n") : "";

    if (saveTriggeredRef.current) {
      saveTriggeredRef.current = false;
      if (editorRef.current) {
        const currentContent = editorRef.current.innerHTML;
        cleanedOriginalRef.current = currentContent;
        editHtmlRef.current = currentContent;
        setEditHtml(currentContent);
      }
    } else {
      setEditHtml(article.htmlContent);
      editHtmlRef.current = article.htmlContent;
      cleanedOriginalRef.current = "";
    }
  }, [article.htmlContent]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || isEditing) return;

    const handleTextSelection = () => {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;
      const selection = iframeDoc.getSelection();
      const text = selection?.toString().trim() || "";
      if (text.length > 8) {
        setSelectedText(text);
        setShowCommentInput(true);
      }
    };

    const onLoad = () => {
      iframe.contentDocument?.addEventListener("mouseup", handleTextSelection);
    };
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") onLoad();
    return () => {
      iframe.removeEventListener("load", onLoad);
      iframe.contentDocument?.removeEventListener("mouseup", handleTextSelection);
    };
  }, [article.htmlContent, isEditing]);

  const hasUnsavedChanges = cleanedOriginalRef.current
    ? editHtml !== cleanedOriginalRef.current
    : false;

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      editHtmlRef.current = editorRef.current.innerHTML;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setEditHtml(editHtmlRef.current);
      }, 300);
    }
  }, []);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  }, [handleEditorInput]);

  const patch = async (body: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onUpdate(await res.json());
      else {
        const data = await res.json();
        alert(data.error || "Aktion fehlgeschlagen");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveContent = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      let bodyContent: string;

      if (isHtmlView) {
        bodyContent = htmlSource;
      } else {
        bodyContent = editHtmlRef.current;
        if (editorRef.current) {
          const clone = editorRef.current.cloneNode(true) as HTMLElement;
          clone.querySelectorAll(".content-check-highlight").forEach((mark) => {
            const parent = mark.parentNode;
            if (parent) {
              while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
              parent.removeChild(mark);
              parent.normalize();
            }
          });
          bodyContent = clone.innerHTML;
        }
      }

      const fullHtml = styleBlocksRef.current
        ? `${styleBlocksRef.current}\n${bodyContent}`
        : bodyContent;

      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: fullHtml }),
      });
      if (res.ok) {
        const updated = await res.json();
        saveTriggeredRef.current = true;
        onUpdate(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        const data = await res.json();
        alert(data.error || "Speichern fehlgeschlagen");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleHtmlView = () => {
    if (!isHtmlView) {
      const current = editorRef.current?.innerHTML || editHtmlRef.current;
      setHtmlSource(current);
      editHtmlRef.current = current;
      setEditHtml(current);
    } else if (editorRef.current) {
      editorRef.current.innerHTML = htmlSource;
      editHtmlRef.current = htmlSource;
      setEditHtml(htmlSource);
    }
    setIsHtmlView((v) => !v);
  };

  const handlePdfApprovalToggle = async () => {
    setPdfApprovalUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfApproved: !article.pdfApprovedAt }),
      });
      if (res.ok) onUpdate(await res.json());
      else {
        const data = await res.json();
        alert(data.error || "PDF-Freigabe fehlgeschlagen");
      }
    } finally {
      setPdfApprovalUpdating(false);
    }
  };

  const submitComment = async () => {
    if (!selectedText.trim() || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          commentText,
          role: commentRole,
          changeAndForward,
          recheckAfterRevision,
        }),
      });
      if (res.ok) {
        const detail = await fetch(`/api/content-reviews/${article.id}`);
        if (detail.ok) onUpdate(await detail.json());
        setCommentText("");
        setSelectedText("");
        setShowCommentInput(false);
        setChangeAndForward(false);
        setRecheckAfterRevision(false);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const toggleResolved = async (commentId: string, resolved: boolean) => {
    const res = await fetch(`/api/content-reviews/${article.id}/comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, resolved }),
    });
    if (res.ok) {
      const detail = await fetch(`/api/content-reviews/${article.id}`);
      if (detail.ok) onUpdate(await detail.json());
    }
  };

  const requestRevision = async () => {
    const res = await fetch(`/api/content-reviews/${article.id}/request-revision`, { method: "POST" });
    if (res.ok) {
      const detail = await fetch(`/api/content-reviews/${article.id}`);
      if (detail.ok) onUpdate(await detail.json());
    } else {
      const data = await res.json();
      alert(data.error || "Überarbeitung konnte nicht angefordert werden");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">
          ← Zurück
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-1 truncate">{article.title}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {REVIEW_STATUSES.map((status, i) => {
          const cfg = STATUS_CONFIG[status];
          const done = currentStepIndex >= i;
          return (
            <span
              key={status}
              className={`text-[10px] px-2 py-0.5 rounded-full ${done ? `${cfg.bg} ${cfg.color}` : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}
            >
              {cfg.label}
            </span>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        {article.category}
        {article.location ? ` · ${article.location}` : ""}
        {article.language ? ` · ${article.language}` : ""}
        {" · "}
        {article.targetAudience}
        {" · "}
        {article.wordCount} Wörter
        {article.reviewStepDueAt && article.reviewStatus !== "published"
          ? ` · fällig ${formatReviewDueDateDe(article.reviewStepDueAt)}`
          : ""}
        {article.claimedByName ? ` · beansprucht von ${article.claimedByName}` : ""}
      </p>

      {hasOpenRevision && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
          Überarbeitung angefordert von {article.revisionRequestedBy}. {unresolved.length} offene Kommentare.
          {canEditContent && (
            <button
              onClick={() => patch({ resolveRevision: true })}
              className="ml-3 underline"
            >
              Als erledigt markieren
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {nextAction && canForward && !hasOpenRevision && (
          <button
            disabled={updating}
            onClick={() => patch({ reviewStatus: nextAction.status })}
            className={`px-3 py-1.5 text-sm text-white rounded-lg ${nextAction.color} disabled:opacity-50`}
          >
            {nextAction.label}
          </button>
        )}
        {unresolved.length > 0 && !hasOpenRevision && article.reviewStatus !== "draft" && article.reviewStatus !== "published" && (
          <button
            onClick={requestRevision}
            className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 dark:text-red-300"
          >
            Überarbeitung anfordern
          </button>
        )}
        <button
          onClick={() => patch({ claim: !article.claimedAt || article.claimedByUserId !== userId })}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600"
        >
          {article.claimedByUserId === userId ? "Freigeben" : "Beanspruchen"}
        </button>
        {isAdmin && currentStepIndex > 0 && (
          <select
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) patch({ resetToStatus: e.target.value });
            }}
          >
            <option value="">Zurücksetzen…</option>
            {REVIEW_STATUSES.slice(0, currentStepIndex).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        )}
        {showPdfActions && (
          <>
            <button
              onClick={canDownloadPdf ? () => downloadContentReviewPdf(article) : undefined}
              disabled={!canDownloadPdf}
              title={!canDownloadPdf ? "PDF muss erst von der Agentur freigegeben werden" : "Revisions-PDF herunterladen"}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 ${
                canDownloadPdf
                  ? "bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              Revisions-PDF
            </button>
            {canEditContent && (
              <label
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border cursor-pointer select-none ${
                  article.pdfApprovedAt
                    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-600"
                } ${pdfApprovalUpdating ? "opacity-50 pointer-events-none" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={!!article.pdfApprovedAt}
                  onChange={handlePdfApprovalToggle}
                  disabled={pdfApprovalUpdating}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                />
                PDF geprüft
                {article.pdfApprovedAt && article.pdfApprovedBy && (
                  <span className="text-xs text-slate-500">({article.pdfApprovedBy})</span>
                )}
              </label>
            )}
            {!canEditContent && !article.pdfApprovedAt && (
              <span className="text-xs text-slate-400 self-center">PDF noch nicht freigegeben</span>
            )}
          </>
        )}
        {isAdmin && (
          <button
            onClick={async () => {
              if (!confirm("Artikel wirklich löschen?")) return;
              const res = await fetch(`/api/content-reviews/${article.id}`, { method: "DELETE" });
              if (res.ok) onDelete();
            }}
            className="px-3 py-1.5 text-sm rounded-lg text-red-600"
          >
            Löschen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <div>
              {canEditContent && (
                <button
                  onClick={() => {
                    setIsHtmlView(false);
                    setIsEditing((v) => !v);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    isEditing
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-600"
                  }`}
                >
                  {isEditing ? "Vorschau" : "Bearbeiten"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEditContent && isEditing ? (
                <>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Gespeichert</span>
                  )}
                  {hasUnsavedChanges && !saveSuccess && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Ungespeicherte Änderungen</span>
                  )}
                  <button
                    onClick={handleSaveContent}
                    disabled={saving || !hasUnsavedChanges}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {saving ? "Speichern…" : "Speichern"}
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400">Text markieren, um zu kommentieren</span>
              )}
            </div>
          </div>

          {canEditContent && isEditing && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              {!isHtmlView && (
                <>
                  <button onClick={() => execCommand("bold")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Fett">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
                  </button>
                  <button onClick={() => execCommand("italic")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Kursiv">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                  </button>
                  <button onClick={() => execCommand("underline")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Unterstrichen">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
                  <button onClick={() => execCommand("formatBlock", "h2")} className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300" title="Überschrift 2">H2</button>
                  <button onClick={() => execCommand("formatBlock", "h3")} className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300" title="Überschrift 3">H3</button>
                  <button onClick={() => execCommand("formatBlock", "p")} className="px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs text-slate-600 dark:text-slate-300" title="Absatz">P</button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
                  <button onClick={() => execCommand("insertUnorderedList")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Aufzählung">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
                  </button>
                  <button onClick={() => execCommand("insertOrderedList")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Nummerierte Liste">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
                  <button onClick={() => execCommand("removeFormat")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Formatierung entfernen">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 10L3 10M21 6L3 6M15.5 14L3 14M11.5 18L3 18"/><line x1="19" y1="12" x2="13" y2="20"/><line x1="13" y1="12" x2="19" y2="20"/></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
                </>
              )}
              <button
                onClick={toggleHtmlView}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  isHtmlView
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    : "hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                }`}
                title={isHtmlView ? "Zurück zum visuellen Editor" : "HTML-Quellcode bearbeiten"}
              >
                {isHtmlView ? "Visual" : "HTML"}
              </button>
            </div>
          )}

          <div className="relative flex-1 min-h-[500px]">
            {canEditContent && isEditing ? (
              <>
                <textarea
                  value={htmlSource}
                  onChange={(e) => {
                    setHtmlSource(e.target.value);
                    editHtmlRef.current = e.target.value;
                    setEditHtml(e.target.value);
                  }}
                  className={`absolute inset-0 w-full h-full p-4 font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border-0 resize-none focus:outline-none ${
                    isHtmlView ? "block" : "hidden"
                  }`}
                  spellCheck={false}
                />
                <div className={isHtmlView ? "hidden" : "block absolute inset-0"}>
                  <ContentEditor
                    editorRef={editorRef}
                    initialHtml={article.htmlContent}
                    onInput={handleEditorInput}
                    onInitialized={(cleanHtml) => {
                      cleanedOriginalRef.current = cleanHtml;
                      editHtmlRef.current = cleanHtml;
                      setEditHtml(cleanHtml);
                    }}
                  />
                </div>
              </>
            ) : (
              <iframe
                ref={iframeRef}
                title="Artikel"
                srcDoc={article.htmlContent}
                className="w-full h-full absolute inset-0 bg-white"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          {showCommentInput && selectedText && !isEditing && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <p className="text-xs text-slate-500 line-clamp-3">„{selectedText}“</p>
              <select
                value={commentRole}
                onChange={(e) => setCommentRole(e.target.value as CommentRole)}
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2 py-1"
              >
                {COMMENT_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent p-2"
                placeholder="Kommentar…"
              />
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={changeAndForward} onChange={(e) => setChangeAndForward(e.target.checked)} />
                Ändern und weitergeben
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={recheckAfterRevision} onChange={(e) => setRecheckAfterRevision(e.target.checked)} />
                Recheck nach Überarbeitung
              </label>
              <div className="flex gap-2">
                <button
                  onClick={submitComment}
                  disabled={submittingComment}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg"
                >
                  Speichern
                </button>
                <button onClick={() => setShowCommentInput(false)} className="px-3 py-1.5 text-sm">
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Kommentare ({unresolved.length} offen)
            </h2>
            <p className="text-[11px] text-slate-400 mb-3">Text im Artikel markieren, um zu kommentieren.</p>
            <div className="space-y-3 max-h-[35vh] overflow-y-auto">
              {(article.comments || []).length === 0 && (
                <p className="text-xs text-slate-400">Noch keine Kommentare.</p>
              )}
              {(article.comments || []).map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border p-3 text-xs ${
                    c.resolved
                      ? "border-slate-200 dark:border-slate-700 opacity-70"
                      : "border-amber-200 dark:border-amber-800"
                  }`}
                >
                  <p className="italic text-slate-500 line-clamp-2">„{c.selectedText}“</p>
                  <p className="mt-1 text-slate-800 dark:text-slate-200">{c.commentText}</p>
                  <p className="mt-1 text-slate-400">
                    {c.author.name || c.author.email} · {ROLE_LABELS[c.role as keyof typeof ROLE_LABELS] || c.role}
                  </p>
                  <button
                    onClick={() => toggleResolved(c.id, !c.resolved)}
                    className="mt-1 text-blue-600 dark:text-blue-400"
                  >
                    {c.resolved ? "Wieder öffnen" : "Erledigen"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Änderungsverlauf ({history.length})
            </h2>
            <div className="space-y-2 max-h-[25vh] overflow-y-auto">
              {history.length === 0 && (
                <p className="text-xs text-slate-400">Noch keine Änderungen protokolliert.</p>
              )}
              {[...history].reverse().map((entry) => {
                const described = describeHistoryEntry(entry);
                return (
                  <div key={entry.id} className="text-xs border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{described.action}</p>
                    <p className="text-slate-500">{described.status}</p>
                    <p className="text-slate-400">
                      {entry.changedByName || entry.changedByEmail || "Unbekannt"} ·{" "}
                      {new Date(entry.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentEditor({
  editorRef,
  initialHtml,
  onInput,
  onInitialized,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  initialHtml: string;
  onInput: () => void;
  onInitialized?: (cleanHtml: string) => void;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(initialHtml, "text/html");

      doc.querySelectorAll("style").forEach((el) => el.remove());
      doc.querySelectorAll("script").forEach((el) => el.remove());

      doc.querySelectorAll("[style]").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.removeProperty("color");
        htmlEl.style.removeProperty("background-color");
        htmlEl.style.removeProperty("background");
        if (!htmlEl.getAttribute("style")?.trim()) {
          htmlEl.removeAttribute("style");
        }
      });

      const cleanHtml = doc.body.innerHTML;
      editorRef.current.innerHTML = cleanHtml;
      initialized.current = true;
      onInitialized?.(cleanHtml);
    }
  }, [editorRef, initialHtml, onInitialized]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onBlur={onInput}
      className="content-editor-area absolute inset-0 overflow-y-auto p-6 max-w-none focus:outline-none"
    />
  );
}
