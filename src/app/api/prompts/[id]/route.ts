export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";

// PATCH /api/prompts/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.systemPrompt) patch.systemPrompt = body.systemPrompt;
    if (body.contentType) patch.contentType = body.contentType;
    if (typeof body.active === "boolean") patch.active = body.active;

    const { data: updated } = await db
      .from("PromptTemplate")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    return NextResponse.json({ success: true, prompt: updated });
  } catch (error) {
    console.error("Prompt PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/prompts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.from("PromptTemplate").delete().eq("id", params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prompt DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
