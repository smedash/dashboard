// Role-Based Access Control (RBAC) Helper
// Rollen: superadmin > member > viewer

export type Role = "superadmin" | "member" | "viewer";

// Rollen-Hierarchie (höhere Zahl = mehr Rechte)
const ROLE_LEVELS: Record<Role, number> = {
  viewer: 1,
  member: 2,
  superadmin: 3,
};

// Prüft ob User mindestens die angegebene Rolle hat
export function hasRole(userRole: string | undefined | null, requiredRole: Role): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_LEVELS[userRole as Role] ?? 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

// Prüft ob User Superadmin ist
export function isSuperadmin(userRole: string | undefined | null): boolean {
  return userRole === "superadmin";
}

// Prüft ob User mindestens Member ist (kann bearbeiten)
export function canEdit(userRole: string | undefined | null): boolean {
  return hasRole(userRole, "member");
}

// Prüft ob User mindestens Viewer ist (kann lesen)
export function canView(userRole: string | undefined | null): boolean {
  return hasRole(userRole, "viewer");
}

// Rollen-Labels für UI
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  member: "Mitglied",
  viewer: "Betrachter",
};

// Rollen-Beschreibungen
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  superadmin: "Volle Rechte - kann Nutzer verwalten und alle Inhalte bearbeiten",
  member: "Kann alle Inhalte sehen und bearbeiten",
  viewer: "Kann alle Inhalte nur ansehen",
};
