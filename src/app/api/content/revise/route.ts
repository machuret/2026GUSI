export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { logAiUsage } from "@/lib/aiUsage";
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

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt: `Original request: ${original.prompt}`,
      model: MODEL_CONFIG.revise,
      maxTokens: 2000,
      temperature: 0.6,
      jsonMode: false,
    });
    const output = aiResult.content.trim();

    if (!output) {
      return NextResponse.json({ error: "AI returned empty content — please try again" }, { status: 500 });
    }

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

    logAiUsage({ model: MODEL_CONFIG.revise, feature: "revise", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens, userId: authUser.id });

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
