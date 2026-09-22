"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  COMMENT_ROLES,
  NEXT_STATUS,
  REVIEW_STATUSES,
  STATUS_CONFIG,
  canTransitionStatus,
  defaultCommentRole,
  type CommentRole,
} from "@/lib/content-workflow";
import { formatReviewDueDateDe } from "@/lib/review-deadline";

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
  comments?: ReviewComment[];
  statusHistory?: {
    id: string;
    fromStatus: string;
    toStatus: string;
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
  const [htmlSource, setHtmlSource] = useState(article.htmlContent);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasOpenRevision = !!article.revisionRequestedAt;
  const unresolved = (article.comments || []).filter((c) => !c.resolved);
  const nextAction = NEXT_STATUS[article.reviewStatus];
  const canForward = canTransitionStatus(userRole, article.reviewStatus);
  const statusConfig = STATUS_CONFIG[article.reviewStatus] || STATUS_CONFIG.draft;
  const currentStepIndex = REVIEW_STATUSES.indexOf(article.reviewStatus as (typeof REVIEW_STATUSES)[number]);

  useEffect(() => {
    setCommentRole(defaultCommentRole(article.reviewStatus));
    setHtmlSource(article.htmlContent);
  }, [article.reviewStatus, article.htmlContent]);

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

  const saveHtml = async () => {
    await patch({ htmlContent: htmlSource });
    setIsEditing(false);
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
        {canEditContent && (
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600"
          >
            {isEditing ? "Vorschau" : "HTML bearbeiten"}
          </button>
        )}
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
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[520px]">
          {isEditing ? (
            <div className="flex flex-col h-[70vh]">
              <textarea
                value={htmlSource}
                onChange={(e) => setHtmlSource(e.target.value)}
                className="flex-1 font-mono text-xs p-3 bg-slate-50 dark:bg-slate-900"
              />
              <button onClick={saveHtml} className="m-3 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
                HTML speichern
              </button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title="Artikel"
              srcDoc={article.htmlContent}
              className="w-full h-[70vh] bg-white"
              sandbox="allow-same-origin"
            />
          )}
        </div>

        <div className="space-y-4">
          {showCommentInput && selectedText && (
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
            <div className="space-y-3 max-h-[55vh] overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}
