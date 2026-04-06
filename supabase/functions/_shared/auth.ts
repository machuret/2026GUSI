/**
 * _shared/auth.ts
 * Request authentication helper for Supabase Edge Functions.
 *
 * Single-tenant app — mirrors the requireEdgeAuth() pattern used by the
 * Next.js API routes. Accepts a request if either:
 *   1. The `apikey` header matches the Supabase anon key, OR
 *   2. A `Authorization: Bearer <token>` header is present.
 *
 * Avoids JWT round-trips to Supabase Auth which fail when the session
 * expires or when requests arrive during token refresh.
 */

import { createLogger } from "./logger.ts";

const log = createLogger("auth");

export interface AuthResult {
  /** Always "service" in single-tenant mode — reserved for future multi-tenant use. */
  userId: string;
}

/**
 * Verifies an Edge Function request using the single-tenant auth pattern.
 * Accepts the request if the `apikey` header matches `supabaseAnonKey`, or
 * if an `Authorization: Bearer` header is present.
 *
 * @returns `AuthResult` on success, or `null` if the request is not authenticated.
 *
 * @example
 * ```ts
 * const auth = verifyRequest(req, SUPABASE_ANON_KEY);
 * if (!auth) return json({ error: "Unauthorized" }, 401);
 * ```
 */
export function verifyRequest(
  req: Request,
  supabaseAnonKey: string,
): AuthResult | null {
  const apikey = req.headers.get("apikey") ?? "";
  const auth   = req.headers.get("authorization") ?? "";

  const valid = (supabaseAnonKey && apikey === supabaseAnonKey)
    || auth.startsWith("Bearer ");

  if (!valid) {
    log.warn("Unauthorized request — no valid apikey or Bearer token");
    return null;
  }

  return { userId: "service" };
}
