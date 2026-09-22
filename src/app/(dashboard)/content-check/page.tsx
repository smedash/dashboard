"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { canEditContentRole, hasFullAdminRights } from "@/lib/rbac";
import { REVIEW_STATUSES, STATUS_CONFIG } from "@/lib/content-workflow";
import { formatReviewDueDateDe, isReviewStepPastDue } from "@/lib/review-deadline";
import { ArticleReviewView, type ReviewArticle } from "@/components/content-check/ArticleReviewView";

interface ListArticle extends ReviewArticle {
  _count?: { comments: number; unresolvedComments: number; resolvedComments: number };
}

export default function ContentCheckPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <ContentCheckInner />
    </Suspense>
  );
}

function ContentCheckInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<ListArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<ReviewArticle | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/content-reviews");
    if (res.ok) {
      setArticles(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const articleId = searchParams.get("article");
    if (!articleId) return;
    fetch(`/api/content-reviews/${articleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSelected(data);
      });
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return articles.filter((a) => {
      if (filterStatus !== "all" && a.reviewStatus !== filterStatus) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || (a.htmlContent || "").toLowerCase().includes(q);
    });
  }, [articles, filterStatus, searchQuery]);

  if (selected) {
    return (
      <ArticleReviewView
        article={selected}
        onBack={() => {
          setSelected(null);
          loadList();
        }}
        onUpdate={(a) => {
          setSelected(a);
          setArticles((prev) => prev.map((p) => (p.id === a.id ? { ...p, ...a } : p)));
        }}
        canEditContent={canEditContentRole(session?.user?.role)}
        isAdmin={hasFullAdminRights(session?.user?.role)}
        userId={session?.user?.id}
        userRole={session?.user?.role}
        onDelete={() => {
          setSelected(null);
          loadList();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Check</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Freigabe-Workflow: Entwurf → Search Manager → Content Manager → Segment Manager → Compliance Manager → Legal → Freigegeben → Publiziert
        </p>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Titel oder Inhalt durchsuchen…"
          className="w-full pl-3 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full ${
            filterStatus === "all"
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          Alle ({articles.length})
        </button>
        {REVIEW_STATUSES.map((status) => {
          const config = STATUS_CONFIG[status];
          const count = articles.filter((a) => a.reviewStatus === status).length;
          if (count === 0 && filterStatus !== status) return null;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full ${
                filterStatus === status
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : `${config.bg} ${config.color}`
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-12 text-center">
          Keine Artikel in dieser Ansicht.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {filtered.map((article) => {
            const statusConfig = STATUS_CONFIG[article.reviewStatus] || STATUS_CONFIG.draft;
            const pastDue = isReviewStepPastDue(article.reviewStepDueAt ? new Date(article.reviewStepDueAt) : null);
            return (
              <button
                key={article.id}
                onClick={async () => {
                  const res = await fetch(`/api/content-reviews/${article.id}`);
                  if (res.ok) setSelected(await res.json());
                }}
                className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {article.category}
                      {article.location ? ` · ${article.location}` : ""}
                      {" · "}
                      {article.wordCount} Wörter
                      {article._count?.unresolvedComments ? ` · ${article._count.unresolvedComments} offene Kommentare` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {article.revisionRequestedAt && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Überarbeitung
                      </span>
                    )}
                    {article.reviewStepDueAt && article.reviewStatus !== "published" && (
                      <span className={`text-[10px] ${pastDue ? "text-red-600" : "text-slate-400"}`}>
                        bis {formatReviewDueDateDe(article.reviewStepDueAt)}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
