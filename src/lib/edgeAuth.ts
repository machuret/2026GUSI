import { NextRequest, NextResponse } from "next/server";

/**
 * Edge-compatible auth check.
 * Single-tenant app — verifies the request originates from the app by checking
 * that either the apikey header matches the anon key, or a Bearer token is present.
 * Avoids JWT round-trips to Supabase that fail when the session expires.
 */
export function requireEdgeAuth(req: NextRequest): { error: NextResponse | null } {
  const apikey = req.headers.get("apikey") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const valid = (supabaseAnonKey && apikey === supabaseAnonKey) || auth.startsWith("Bearer ");

  if (!valid) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { error: null };
}
