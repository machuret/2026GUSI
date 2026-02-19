export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const lessonSchema = z.object({
  contentType: z.string().nullable().optional(),
  feedback: z.string().min(1),
  source: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

// GET /api/lessons
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const rawLimit = parseInt(p.get("limit") ?? "100", 10);
    const rawOffset = parseInt(p.get("offset") ?? "0", 10);
    const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 100 : rawLimit));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

    const { data: lessons, count } = await db
      .from("Lesson")
      .select("*", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({ lessons: lessons ?? [], total: count ?? 0, limit, offset });
  } catch (error) {
    return handleApiError(error, "Lessons GET");
  }
}

// POST /api/lessons — manually add a lesson
export async function POST(req: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = lessonSchema.parse(body);

    const { data: lesson } = await db
      .from("Lesson")
      .insert({
        companyId: DEMO_COMPANY_ID,
        contentType: data.contentType || null,
        feedback: data.feedback,
        source: data.source || "manual",
        severity: data.severity,
      })
      .select()
      .single();

    await logActivity(user.id, user.email || "", "lesson.create", data.feedback.slice(0, 100));

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    return handleApiError(error, "Lessons POST");
  }
}
