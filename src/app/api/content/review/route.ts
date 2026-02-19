export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { findContentById, updateContent } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const reviewSchema = z.object({
  contentId: z.string().min(1),
  category: z.string().min(1),
  action: z.enum(["approve", "reject", "edit", "publish"]),
  feedback: z.string().optional(),
  output: z.string().optional(),
});

// POST /api/content/review — approve or reject generated content
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = reviewSchema.parse(body);

    const found = await findContentById(data.contentId, data.category);
    if (!found) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { record: content, category, categoryLabel } = found;

    if (data.action === "approve") {
      await updateContent(category, data.contentId, { status: "APPROVED" });
      await logActivity(authUser.id, authUser.email || "", "content.approve", `Approved ${categoryLabel} content`);
      return NextResponse.json({ success: true, status: "APPROVED" });
    }

    if (data.action === "edit") {
      if (!data.output?.trim()) {
        return NextResponse.json({ error: "Output is required for edit" }, { status: 400 });
      }
      await updateContent(category, data.contentId, { output: data.output });
      await logActivity(authUser.id, authUser.email || "", "content.edit", `Edited ${categoryLabel} content`);
      return NextResponse.json({ success: true, action: "edited" });
    }

    if (data.action === "publish") {
      await updateContent(category, data.contentId, { status: "PUBLISHED" });
      await logActivity(authUser.id, authUser.email || "", "content.publish", `Marked ${categoryLabel} for publishing`);
      return NextResponse.json({ success: true, status: "PUBLISHED" });
    }

    // Reject — feedback is required
    if (!data.feedback?.trim()) {
      return NextResponse.json({ error: "Feedback is required when rejecting content" }, { status: 400 });
    }

    await updateContent(category, data.contentId, {
      status: "REJECTED",
      feedback: data.feedback,
    });

    // Auto-create a lesson from the feedback
    await db.from("Lesson").insert({
      companyId: content.companyId,
      contentType: category,
      feedback: data.feedback,
      source: "rejection",
      severity: "high",
    });

    await logActivity(
      authUser.id,
      authUser.email || "",
      "content.reject",
      `Rejected ${categoryLabel}: ${data.feedback.slice(0, 100)}`
    );

    return NextResponse.json({ success: true, status: "REJECTED", lessonCreated: true });
  } catch (error) {
    return handleApiError(error, "Review");
  }
}
