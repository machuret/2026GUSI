export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { findContentById, updateContent } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const scheduleSchema = z.object({
  contentId: z.string().min(1),
  scheduledAt: z.string().nullable(), // ISO date string or null to clear
});

// POST /api/content/schedule
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = scheduleSchema.parse(body);

    const found = await findContentById(data.contentId);
    if (!found) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { category, categoryLabel } = found;

    await updateContent(category, data.contentId, {
      scheduledAt: data.scheduledAt ?? null,
    });

    await logActivity(
      authUser.id,
      authUser.email || "",
      "content.schedule",
      `Scheduled ${categoryLabel} for ${data.scheduledAt ?? "unscheduled"}`
    );

    return NextResponse.json({ success: true, scheduledAt: data.scheduledAt });
  } catch (error) {
    return handleApiError(error, "Schedule");
  }
}
