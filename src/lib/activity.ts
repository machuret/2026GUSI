import { db } from "./db";
import { getAppUser } from "./auth";

/**
 * Log a user action. Automatically creates the User record if it doesn't exist.
 */
export async function logActivity(
  authId: string,
  email: string,
  action: string,
  details?: string
) {
  const user = await getAppUser(authId, email);
  await db.from("ActivityLog").insert({ userId: user.id, action, details });
  return user;
}

/**
 * Get activity logs with user info, ordered by most recent.
 */
export async function getActivityLogs(limit = 100) {
  const { data } = await db
    .from("ActivityLog")
    .select("*, user:User(name, email, role)")
    .order("createdAt", { ascending: false })
    .limit(limit);
  return data ?? [];
}
