import { hasFullAdminRights } from "@/lib/rbac";

export const REVIEW_STATUSES = [
  "draft",
  "seo_review",
  "content_review",
  "segment_review",
  "legal_review",
  "approved",
  "published",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const COMMENT_ROLES = [
  "seo_manager",
  "content_manager",
  "segment_manager",
  "legal",
] as const;

export type CommentRole = (typeof COMMENT_ROLES)[number];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["seo_review"],
  seo_review: ["content_review"],
  content_review: ["segment_review"],
  segment_review: ["legal_review"],
  legal_review: ["approved"],
  approved: ["published"],
  published: [],
};

export const STATUS_NOTIFY_ROLES: Record<string, string[]> = {
  seo_review: ["seo_manager"],
  content_review: ["content_manager"],
  segment_review: ["segment_manager"],
  legal_review: ["legal"],
  approved: ["agentur", "superadmin"],
  published: ["agentur", "superadmin"],
};

export const STATUS_RESPONSIBLE_ROLE: Record<string, string> = {
  seo_review: "seo_manager",
  content_review: "content_manager",
  segment_review: "segment_manager",
  legal_review: "legal",
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: {
    label: "Entwurf",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-700",
  },
  seo_review: {
    label: "SEO Manager",
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-100 dark:bg-cyan-900/40",
  },
  content_review: {
    label: "Content Manager",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-900/40",
  },
  segment_review: {
    label: "Segment Manager",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  },
  legal_review: {
    label: "Legal",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-100 dark:bg-orange-900/40",
  },
  approved: {
    label: "Freigegeben",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  published: {
    label: "Publiziert",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-100 dark:bg-green-900/40",
  },
};

export const NEXT_STATUS: Record<
  string,
  { status: string; label: string; color: string }
> = {
  draft: {
    status: "seo_review",
    label: "An SEO Manager senden",
    color: "bg-cyan-600 hover:bg-cyan-700",
  },
  seo_review: {
    status: "content_review",
    label: "An Content Manager senden",
    color: "bg-rose-600 hover:bg-rose-700",
  },
  content_review: {
    status: "segment_review",
    label: "An Segment Manager senden",
    color: "bg-amber-600 hover:bg-amber-700",
  },
  segment_review: {
    status: "legal_review",
    label: "An Legal senden",
    color: "bg-orange-600 hover:bg-orange-700",
  },
  legal_review: {
    status: "approved",
    label: "Legal freigeben",
    color: "bg-indigo-600 hover:bg-indigo-700",
  },
  approved: {
    status: "published",
    label: "Als publiziert markieren",
    color: "bg-green-600 hover:bg-green-700",
  },
};

export function describeHistoryEntry(entry: {
  fromStatus: string;
  toStatus: string;
  comment: string | null;
}): { action: string; status: string } {
  const from = STATUS_CONFIG[entry.fromStatus]?.label || entry.fromStatus;
  const to = STATUS_CONFIG[entry.toStatus]?.label || entry.toStatus;

  switch (entry.comment) {
    case "revision_requested":
      return { action: "Überarbeitung angefordert", status: from };
    case "revision_resolved":
      return { action: "Überarbeitet", status: from };
    case "status_reset":
      return { action: "Zurückgesetzt", status: `${from} → ${to}` };
    case "content_updated":
      return { action: "Inhalt gespeichert", status: from };
    case "pdf_approved":
      return { action: "PDF freigegeben", status: from };
    case "pdf_unapproved":
      return { action: "PDF-Freigabe entfernt", status: from };
    case "implicit_approval":
      return { action: "Freigegeben (o. Recheck)", status: from };
    default:
      if (entry.toStatus === "approved" || entry.toStatus.endsWith("_approved")) {
        return { action: "Freigegeben", status: `${from} → ${to}` };
      }
      return { action: "Weitergereicht", status: `${from} → ${to}` };
  }
}

export function canTransitionStatus(
  userRole: string | undefined | null,
  fromStatus: string
): boolean {
  if (hasFullAdminRights(userRole)) return true;
  const responsible = STATUS_RESPONSIBLE_ROLE[fromStatus];
  if (responsible && userRole === responsible) return true;
  return false;
}

export function defaultCommentRole(status: string): CommentRole {
  switch (status) {
    case "content_review":
      return "content_manager";
    case "segment_review":
      return "segment_manager";
    case "legal_review":
    case "approved":
    case "published":
      return "legal";
    default:
      return "seo_manager";
  }
}

export function journeyPhaseToFunnel(phase: string | null | undefined): string {
  if (!phase) return "";
  if (phase === "awareness" || phase === "orientation") return "Upper-Funnel";
  if (phase === "planning") return "Mid-Funnel";
  if (phase === "product_search" || phase === "closing") return "Lower-Funnel";
  return "";
}

export const CONTENT_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
  "Credit Suisse",
  "Investor Relations",
  "Legal",
  "Media",
  "Payments",
  "Yumo",
  "Wealthmanagement",
  "Assetmanagement",
] as const;

export const CONTENT_LOCATIONS = [
  "Guide",
  "Insights",
  "CH Market",
  "Global",
  "Microsites",
  "Minisites",
] as const;

export const FUNNEL_OPTIONS = [
  { value: "Upper-Funnel", label: "Upper Funnel" },
  { value: "Mid-Funnel", label: "Mid Funnel" },
  { value: "Lower-Funnel", label: "Lower Funnel" },
] as const;

export const ZIELGRUPPEN = [
  "Privatkunden",
  "Firmenkunden",
  "Vermögende Privatkunden",
  "Familien",
  "Anleger",
  "Vorsorgesparer",
  "Ersterwerber",
  "Unternehmer",
  "Young Professionals",
] as const;

export const CONTENT_LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "Englisch" },
  { value: "fr", label: "Französisch" },
  { value: "it", label: "Italienisch" },
] as const;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}
