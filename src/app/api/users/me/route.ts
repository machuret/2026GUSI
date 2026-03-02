export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";
import { userCache } from "@/lib/cache";

// GET /api/users/me — return current user's role for client-side gating.
// Cached for 2 minutes per authId — roles/permissions change rarely.
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cacheKey = `user:${user.id}`;
    const cached = userCache.get(cacheKey);
    if (cached) return NextResponse.json({ user: cached });

    const { data: appUser } = await db
      .from("User")
      .select("id, name, email, role, active, permissions")
      .eq("authId", user.id)
      .maybeSingle();

    if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    userCache.set(cacheKey, appUser);
    return NextResponse.json({ user: appUser });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
