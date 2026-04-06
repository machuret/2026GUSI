/**
 * _shared/auth.ts
 * JWT verification helper for Supabase Edge Functions.
 *
 * Uses the Supabase anon client with the caller's Bearer token to call
 * `auth.getUser()`, which validates the JWT against Supabase Auth.
 * This is the recommended pattern from Supabase docs and is the only
 * approach that actually verifies token authenticity (not just presence).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";

const log = createLogger("auth");

export interface AuthResult {
  /** Supabase user ID of the verified caller. */
  userId: string;
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header on an Edge Function request.
 *
 * @returns `AuthResult` on success, or `null` if the token is missing / invalid.
 *
 * @example
 * ```ts
 * const auth = await verifyRequest(req, SUPABASE_URL, SUPABASE_ANON_KEY);
 * if (!auth) return json({ error: "Unauthorized" }, 401);
 * ```
 */
export async function verifyRequest(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<AuthResult | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    log.warn("Missing Authorization header");
    return null;
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    log.warn("JWT verification failed", { error: error?.message });
    return null;
  }

  return { userId: user.id };
}
