export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

// DELETE /api/users/[id] — delete user from DB and Supabase auth
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireRole(user.id, "SUPER_ADMIN");

    // Get the authId before deleting from DB
    const { data: appUser } = await db
      .from("User")
      .select("authId")
      .eq("id", params.id)
      .maybeSingle();

    if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Prevent self-deletion
    if (appUser.authId === user.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Delete from DB first
    await db.from("User").delete().eq("id", params.id);

    // Delete from Supabase auth
    const admin = serviceClient();
    await admin.auth.admin.deleteUser(appUser.authId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
