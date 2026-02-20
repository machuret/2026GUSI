export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// POST /api/lessons/compile — generate a compiled learning report from all active lessons
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const { ids } = await req.json().catch(() => ({ ids: null }));

    let query = db
      .from("Lesson")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("severity", { ascending: false })
      .order("createdAt", { ascending: false });

    if (Array.isArray(ids) && ids.length > 0) {
      query = query.in("id", ids);
    } else {
      query = query.eq("active", true);
    }

    const { data: lessons } = await query;

    if (!lessons || lessons.length === 0) {
      return NextResponse.json({ error: "No lessons found to compile" }, { status: 400 });
    }

    const lessonLines = lessons.map((l, i) =>
      `${i + 1}. [${l.severity.toUpperCase()}]${l.contentType ? ` (${l.contentType})` : " (global)"} ${l.feedback}`
    ).join("\n");

    const systemPrompt = `You are an AI writing coach. You have been given a list of lessons learned from content rejections and feedback. 
Your job is to synthesize these into a clear, actionable compilation report that an AI content generator can use as its primary style guide.

Structure your report as:
1. **Executive Summary** — 2-3 sentences on the overall patterns
2. **Critical Rules** (High priority) — must always follow
3. **Style Guidelines** (Medium priority) — apply when relevant  
4. **Soft Preferences** (Low priority) — nice to have
5. **Patterns to Avoid** — common mistakes identified
6. **Key Takeaways** — 3-5 bullet points the AI should internalize

Be specific and actionable. This report will be injected directly into AI prompts.`;

    const userPrompt = `Compile these ${lessons.length} lessons into a structured learning report:\n\n${lessonLines}`;

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.generate,
      maxTokens: 2000,
      temperature: 0.3,
      jsonMode: false,
    });

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "lessons.compile",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: authUser.id,
    });

    return NextResponse.json({ report: aiResult.content, lessonCount: lessons.length });
  } catch (err) {
    return handleApiError(err, "Lessons Compile");
  }
}
