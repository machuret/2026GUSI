export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

const VALID_SEVERITIES = ["low", "medium", "high"];

// PATCH /api/lessons/[id] — toggle active or update
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: existing, error: fetchError } = await db
      .from("Lesson")
      .select("companyId")
      .eq("id", params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.feedback) patch.feedback = body.feedback;
    if (body.severity !== undefined) {
      if (!VALID_SEVERITIES.includes(body.severity)) {
        return NextResponse.json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(", ")}` }, { status: 400 });
      }
      patch.severity = body.severity;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from("Lesson")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ success: true, lesson: updated });
  } catch (error) {
    return handleApiError(error, "Lesson PATCH");
  }
}

// DELETE /api/lessons/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: existing, error: fetchError } = await db
      .from("Lesson")
      .select("companyId")
      .eq("id", params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const { error: deleteError } = await db.from("Lesson").delete().eq("id", params.id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Lesson DELETE");
  }
}
