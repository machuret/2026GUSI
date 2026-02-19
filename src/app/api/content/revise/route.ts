export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openai } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { findContentById, updateContent, createContent } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const reviseSchema = z.object({
  contentId: z.string().min(1),
  additionalFeedback: z.string().optional(),
});

// POST /api/content/revise — regenerate content using feedback + lessons
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = reviseSchema.parse(body);

    const found = await findContentById(data.contentId);
    if (!found) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { record: original, category, categoryLabel } = found;

    // Fetch lessons and style profile in parallel
    const [{ data: lessonsData }, { data: styleProfile }] = await Promise.all([
      db.from("Lesson").select("*").eq("companyId", original.companyId).eq("active", true)
        .or(`contentType.eq.${category},contentType.is.null`)
        .order("createdAt", { ascending: false }).limit(20),
      db.from("StyleProfile").select("*").eq("companyId", original.companyId).maybeSingle(),
    ]);

    const lessonsList = lessonsData ?? [];

    // Build lessons context
    const lessonsContext = lessonsList.length > 0
      ? "\n\nLESSONS LEARNED (apply these strictly — these come from past feedback):\n" +
        lessonsList.map((l, i) => {
          const lesson = l as { severity?: string; feedback?: string };
          return `${i + 1}. [${(lesson.severity ?? "medium").toUpperCase()}] ${lesson.feedback ?? ""}`;
        }).join("\n")
      : "";

    // Build revision prompt
    const allFeedback = [
      original.feedback ?? "",
      data.additionalFeedback ?? "",
    ].filter((s) => s.trim()).join("\n\nAdditional feedback: ");

    if (!allFeedback.trim()) {
      return NextResponse.json({ error: "Cannot revise: no rejection feedback found on this content" }, { status: 400 });
    }

    const company = original.company as { name: string } | null;
    const systemPrompt = `You are revising ${categoryLabel} content for ${company?.name ?? "this company"}. The previous version was REJECTED with specific feedback. You must fix ALL issues mentioned in the feedback while maintaining the company's voice.
${styleProfile ? `\nStyle: ${styleProfile.tone}. Vocabulary: ${Array.isArray(styleProfile.vocabulary) ? styleProfile.vocabulary.join(", ") : ""}` : ""}
${lessonsContext}

REJECTION FEEDBACK ON PREVIOUS VERSION:
${allFeedback}

PREVIOUS OUTPUT (that was rejected):
${original.output}

IMPORTANT:
1. Address EVERY point in the feedback
2. Apply ALL lessons learned
3. Keep the same general topic and intent as the original prompt
4. Output ONLY the revised content — no commentary`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Original request: ${original.prompt}` },
      ],
      temperature: 0.6,
      max_tokens: 2000,
    });

    const output = response.choices[0]?.message?.content?.trim() ?? "";

    // Mark original as REVISED
    await updateContent(category, data.contentId, { status: "REVISED" });

    // Log activity and get user
    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.revise",
      `Revised ${categoryLabel}: applied ${lessonsList.length} lessons`
    );

    // Create new content in same category table, linked to original
    const revised = await createContent(category, {
      companyId: original.companyId,
      userId: appUser.id,
      prompt: original.prompt,
      output,
      revisionOf: original.id,
      revisionNumber: (typeof original.revisionNumber === "number" ? original.revisionNumber : 0) + 1,
    });

    return NextResponse.json({
      success: true,
      revised,
      category,
      lessonsApplied: lessonsList.length,
    });
  } catch (error) {
    return handleApiError(error, "Revise");
  }
}
