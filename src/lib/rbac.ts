// Role-Based Access Control (RBAC) Helper
// Rollen: superadmin/agentur > seo_manager/content_manager/segment_manager/legal/member > viewer

export type Role =
  | "superadmin"
  | "agentur"
  | "seo_manager"
  | "content_manager"
  | "segment_manager"
  | "legal"
  | "member"
  | "viewer";

export const ALL_ROLES: Role[] = [
  "superadmin",
  "agentur",
  "seo_manager",
  "content_manager",
  "segment_manager",
  "legal",
  "member",
  "viewer",
];

export const REVIEW_ROLES: Role[] = [
  "seo_manager",
  "content_manager",
  "segment_manager",
  "legal",
];

const ROLE_LEVELS: Record<Role, number> = {
  viewer: 1,
  member: 2,
  seo_manager: 2,
  content_manager: 2,
  segment_manager: 2,
  legal: 2,
  superadmin: 3,
  agentur: 3,
};

export function hasRole(userRole: string | undefined | null, requiredRole: Role): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_LEVELS[userRole as Role] ?? 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

export function isSuperadmin(userRole: string | undefined | null): boolean {
  return userRole === "superadmin";
}

export function isAgentur(userRole: string | undefined | null): boolean {
  return userRole === "agentur";
}

export function hasFullAdminRights(userRole: string | undefined | null): boolean {
  return userRole === "superadmin" || userRole === "agentur";
}

export function canEditContentRole(userRole: string | undefined | null): boolean {
  return hasFullAdminRights(userRole);
}

export function isReviewRole(userRole: string | undefined | null): boolean {
  return REVIEW_ROLES.includes(userRole as Role);
}

export function canEdit(userRole: string | undefined | null): boolean {
  return hasRole(userRole, "member");
}

export function canView(userRole: string | undefined | null): boolean {
  return hasRole(userRole, "viewer");
}

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  agentur: "Agentur",
  seo_manager: "SEO Manager",
  content_manager: "Content Manager",
  segment_manager: "Segment Manager",
  legal: "Legal",
  member: "Mitglied",
  viewer: "Betrachter",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  superadmin: "Volle Rechte - kann Nutzer verwalten und alle Inhalte bearbeiten",
  agentur: "Volle Rechte - kann Nutzer verwalten und alle Inhalte bearbeiten (wie Superadmin)",
  seo_manager: "Erste Freigabestufe im Content-Check",
  content_manager: "Zweite Freigabestufe im Content-Check",
  segment_manager: "Dritte Freigabestufe im Content-Check",
  legal: "Letzte Freigabestufe im Content-Check",
  member: "Kann alle Inhalte sehen und bearbeiten",
  viewer: "Kann alle Inhalte nur ansehen",
};
