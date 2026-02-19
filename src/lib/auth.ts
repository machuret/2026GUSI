import { db } from "./db";

export type AppRole = "SUPER_ADMIN" | "EDITOR";

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

  const role = (count ?? 0) === 0 ? "SUPER_ADMIN" : "EDITOR";

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
  if (user.role !== role && user.role !== "SUPER_ADMIN") {
    throw new Error("Insufficient permissions");
  }
  return user;
}
