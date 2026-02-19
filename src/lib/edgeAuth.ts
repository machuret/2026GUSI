import { NextRequest, NextResponse } from "next/server";

/**
 * Edge-compatible auth check.
 * Verifies the request carries a valid Supabase JWT (anon or service role).
 * Used on edge routes where @supabase/ssr cookie helpers are unavailable.
 *
 * Strategy: validate the Authorization: Bearer <jwt> header against Supabase's
 * /auth/v1/user endpoint using the anon key. If the token is valid, Supabase
 * returns the user object. If not, it returns 401.
 */
export async function requireEdgeAuth(req: NextRequest): Promise<{ error: NextResponse | null }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    return { error: null };
  } catch {
    return { error: NextResponse.json({ error: "Auth check failed" }, { status: 401 }) };
  }
}
