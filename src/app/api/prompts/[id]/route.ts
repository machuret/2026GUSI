export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

// PATCH /api/prompts/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.systemPrompt) patch.systemPrompt = body.systemPrompt;
    if (body.contentType) patch.contentType = body.contentType;
    if (typeof body.active === "boolean") patch.active = body.active;

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from("PromptTemplate")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ success: true, prompt: updated });
  } catch (error) {
    return handleApiError(error, "Prompt PATCH");
  }
}

// DELETE /api/prompts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error: deleteError } = await db.from("PromptTemplate").delete().eq("id", params.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Prompt DELETE");
  }
}
