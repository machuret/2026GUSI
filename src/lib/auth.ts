import { db } from "./db";

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "USER" | "EDITOR";

// Role hierarchy: higher index = more permissions
const ROLE_LEVEL: Record<string, number> = {
  USER:        1,
  EDITOR:      1, // legacy — treated same as USER
  ADMIN:       2,
  SUPER_ADMIN: 3,
};

export function hasRole(userRole: string, requiredRole: AppRole): boolean {
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[requiredRole] ?? 99);
}

export const ROLES: { value: AppRole; label: string; description: string; color: string }[] = [
  {
    value: "USER",
    label: "User",
    description: "Access to all content tools: Generate, Bulk, Voices, Translations, History, Calendar, Grants, Leads, Train AI",
    color: "bg-blue-100 text-blue-700",
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Everything Users can do, plus Settings: Company Info, Vault, Templates, Prompts, Lessons, Activity Log",
    color: "bg-purple-100 text-purple-700",
  },
  {
    value: "SUPER_ADMIN",
    label: "Super Admin",
    description: "Full access including User Management. Can assign roles and enable/disable accounts.",
    color: "bg-red-100 text-red-700",
  },
];

/**
 * Get app user profile (role, name) for a Supabase auth user.
 * Creates a default EDITOR profile if none exists yet.
 */
export async function getAppUser(authId: string, email: string) {
  const { data: existing } = await db
    .from("User")
    .select("*")
    .eq("authId", authId)
    .maybeSingle();

  if (existing) return existing;

  const now = new Date().toISOString();
  // Auto-promote to SUPER_ADMIN if no admin exists yet (first-time bootstrap)
  const { count } = await db
    .from("User")
    .select("id", { count: "exact", head: true })
    .eq("role", "SUPER_ADMIN");

  const role = (count ?? 0) === 0 ? "SUPER_ADMIN" : "USER";

  const { data: created, error } = await db
    .from("User")
    .insert({ authId, email, name: email.split("@")[0], role, updatedAt: now })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return created;
}

export async function requireRole(authId: string, role: AppRole) {
  const { data: user } = await db
    .from("User")
    .select("*")
    .eq("authId", authId)
    .maybeSingle();

  if (!user || !user.active) throw new Error("User not found or inactive");
  if (!hasRole(user.role, role)) {
    throw new Error("Insufficient permissions");
  }
  return user;
}
