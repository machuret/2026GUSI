export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// PATCH /api/users/[id] — update user role or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireRole(user.id, "SUPER_ADMIN");

    const body = await req.json();
    const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "USER", "EDITOR"];
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
      }
      patch.role = body.role;
    }
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.name) patch.name = body.name;
    if (Array.isArray(body.permissions)) patch.permissions = body.permissions;

    const { data: updated } = await db
      .from("User")
      .update(patch)
      .eq("id", params.id)
      .select("id, email, name, role, active, permissions")
      .single();

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
