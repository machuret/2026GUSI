export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// PATCH /api/ideas/[id] — update status, rating, ratingFeedback
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const allowed = ["status", "title", "summary", "rating", "ratingFeedback"];
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await db
      .from("Idea")
      .update(updates)
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Auto-create a Lesson when thumbs-down with feedback is submitted
    if (body.rating === "down" && body.ratingFeedback?.trim()) {
      const lessonText = `[Idea rejected] "${data.title}" — Reason: ${body.ratingFeedback.trim()}`;
      await db.from("Lesson").insert({
        companyId:   DEMO_COMPANY_ID,
        feedback:    lessonText,
        source:      "idea-rejection",
        severity:    "medium",
        contentType: data.contentType ?? null,
      });
    }

    return NextResponse.json({ idea: data });
  } catch (err) {
    return handleApiError(err, "Ideas PATCH");
  }
}

// DELETE /api/ideas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db
      .from("Idea")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Ideas DELETE");
  }
}
