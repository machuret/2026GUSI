export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "EDITOR"]),
});

// GET /api/users — list all users (super admin only)
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireRole(user.id, "SUPER_ADMIN");

    const { data: users } = await db
      .from("User")
      .select("id, authId, email, name, role, active, createdAt")
      .order("createdAt", { ascending: false });

    return NextResponse.json({ users: users ?? [] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

// POST /api/users — create a new user (super admin only)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireRole(authUser.id, "SUPER_ADMIN");

    const body = await req.json();
    const data = createUserSchema.parse(body);

    // Users must be created via Supabase Auth (dashboard or admin.createUser).
    // Creating a User record with a fake authId would break authentication for that user.
    return NextResponse.json(
      { error: "User creation must be done via Supabase Auth dashboard. This endpoint is disabled." },
      { status: 501 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
