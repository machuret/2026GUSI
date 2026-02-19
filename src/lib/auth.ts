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
  const { data: created, error } = await db
    .from("User")
    .insert({ authId, email, name: email.split("@")[0], role: "EDITOR", updatedAt: now })
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
