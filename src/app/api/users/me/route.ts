export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/users/me — return current user's role for client-side gating
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: appUser } = await db
      .from("User")
      .select("id, name, email, role, active")
      .eq("authId", user.id)
      .maybeSingle();

    if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user: appUser });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
