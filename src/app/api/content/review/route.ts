export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { findContentById, updateContent, createContent, CATEGORIES } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { maybeConsolidateLessons } from "@/lib/lessonConsolidator";
import { z } from "zod";

const reviewSchema = z.object({
  contentId: z.string().min(1),
  category: z.string().min(1),
  action: z.enum(["approve", "reject", "edit", "publish", "delete", "change-category"]),
  feedback: z.string().optional(),
  output: z.string().optional(),
  newCategory: z.string().optional(),
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

      // Note: we no longer create a "positive lesson" on approval — approved content
      // is already available as example posts via ContentPost, and approval lessons
      // were polluting the lessons context with redundant low-severity entries.

      // Auto-run compliance scan (fire-and-forget — does not block the approve response)
      const { data: activeRules } = await db
        .from("ComplianceRule")
        .select("id", { count: "exact", head: true })
        .eq("companyId", content.companyId)
        .eq("active", true);
      if ((activeRules as unknown as number | null) !== 0) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/compliance/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId:       data.contentId,
            contentCategory: category,
            contentText:     content.output,
            companyId:       content.companyId,
            saveResult:      true,
          }),
        }).catch(() => {});
      }

      await logActivity(authUser.id, authUser.email || "", "content.approve", `Approved ${categoryLabel} content`);
      return NextResponse.json({ success: true, status: "APPROVED" });
    }

    if (data.action === "edit") {
      if (!data.output?.trim()) {
        return NextResponse.json({ error: "Output is required for edit" }, { status: 400 });
      }
      await updateContent(category, data.contentId, { output: data.output, isEdited: true });
      await logActivity(authUser.id, authUser.email || "", "content.edit", `Edited ${categoryLabel} content`);
      return NextResponse.json({ success: true, action: "edited" });
    }

    if (data.action === "delete") {
      await updateContent(category, data.contentId, { deletedAt: new Date().toISOString() });
      await logActivity(authUser.id, authUser.email || "", "content.delete", `Deleted ${categoryLabel} content`);
      return NextResponse.json({ success: true, action: "deleted" });
    }

    if (data.action === "change-category") {
      if (!data.newCategory?.trim()) {
        return NextResponse.json({ error: "newCategory is required" }, { status: 400 });
      }
      const newCat = CATEGORIES.find((c) => c.key === data.newCategory);
      if (!newCat) {
        return NextResponse.json({ error: `Unknown category: ${data.newCategory}` }, { status: 400 });
      }
      // Copy only base fields to new table (category-specific fields differ per table)
      await createContent(data.newCategory, {
        companyId:     content.companyId,
        userId:        content.userId ?? null,
        prompt:        content.prompt,
        output:        content.output,
        status:        content.status,
        feedback:      content.feedback ?? null,
        revisionOf:    content.revisionOf ?? null,
        revisionNumber: content.revisionNumber ?? 0,
        isEdited:      (content as Record<string, unknown>).isEdited ?? false,
      });
      await updateContent(category, data.contentId, { deletedAt: new Date().toISOString() });
      await logActivity(authUser.id, authUser.email || "", "content.change-category", `Moved ${categoryLabel} → ${newCat.label}`);
      return NextResponse.json({ success: true, action: "category-changed", newCategory: data.newCategory });
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

    // Auto-create a lesson from the rejection feedback
    await db.from("Lesson").insert({
      companyId: content.companyId,
      contentType: category,
      feedback: data.feedback,
      source: "rejection",
      severity: "high",
    });

    // Fire-and-forget: consolidate if too many active lessons
    maybeConsolidateLessons(content.companyId).catch(() => {});

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
