export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";

// PATCH /api/lessons/[id] — toggle active or update
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const patch: Record<string, any> = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.feedback) patch.feedback = body.feedback;
    if (body.severity) patch.severity = body.severity;

    const { data: updated } = await db
      .from("Lesson")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    return NextResponse.json({ success: true, lesson: updated });
  } catch (error) {
    console.error("Lesson PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.from("Lesson").delete().eq("id", params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lesson DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
