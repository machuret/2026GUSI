import { db } from "./db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "./openai";
import { logAiUsage } from "./aiUsage";

const MAX_ACTIVE_LESSONS = 30;
const CONSOLIDATION_TARGET = 15; // after consolidation, aim for ~15 lessons

/**
 * Checks if the company has too many active lessons and auto-consolidates
 * by merging redundant/overlapping lessons into fewer, clearer rules.
 * Called fire-and-forget after rejection — does not block the response.
 */
export async function maybeConsolidateLessons(companyId: string): Promise<void> {
  try {
    const { count } = await db
      .from("Lesson")
      .select("id", { count: "exact", head: true })
      .eq("companyId", companyId)
      .eq("active", true);

    if (!count || count <= MAX_ACTIVE_LESSONS) return;

    // Fetch all active lessons
    const { data: lessons } = await db
      .from("Lesson")
      .select("*")
      .eq("companyId", companyId)
      .eq("active", true)
      .order("severity", { ascending: false })
      .order("createdAt", { ascending: false });

    if (!lessons || lessons.length <= MAX_ACTIVE_LESSONS) return;

    const lessonLines = lessons.map((l, i) =>
      `${i + 1}. [${l.severity.toUpperCase()}]${l.contentType ? ` (${l.contentType})` : " (global)"} ${l.feedback}`
    ).join("\n");

    const aiResult = await callOpenAIWithUsage({
      systemPrompt: `You are a writing rules consolidator. You have ${lessons.length} active content lessons/rules that need to be consolidated into ~${CONSOLIDATION_TARGET} clear, non-redundant rules.

Merge duplicate and overlapping rules. Preserve the severity level of the most important version. Keep the contentType scope if applicable.

Return a JSON array of consolidated rules:
[
  { "feedback": "clear consolidated rule text", "severity": "high|medium|low", "contentType": "category_key or null for global" }
]

Return ONLY the JSON array, no markdown fences.`,
      userPrompt: `Consolidate these ${lessons.length} lessons:\n\n${lessonLines}`,
      model: MODEL_CONFIG.generate,
      maxTokens: 2000,
      temperature: 0.2,
      jsonMode: false,
    });

    let consolidated: { feedback: string; severity: string; contentType: string | null }[];
    try {
      consolidated = JSON.parse(aiResult.content);
      if (!Array.isArray(consolidated)) throw new Error("Not an array");
    } catch {
      // If parsing fails, don't touch existing lessons
      return;
    }

    // Deactivate all old lessons (soft delete — keep for audit trail)
    await db
      .from("Lesson")
      .update({ active: false })
      .eq("companyId", companyId)
      .eq("active", true);

    // Insert consolidated lessons
    if (consolidated.length > 0) {
      await db.from("Lesson").insert(
        consolidated.map((l) => ({
          companyId,
          feedback: l.feedback,
          severity: ["high", "medium", "low"].includes(l.severity) ? l.severity : "medium",
          contentType: l.contentType || null,
          source: "consolidation",
          active: true,
        }))
      );
    }

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "lessons.consolidate",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: "system",
    });
  } catch {
    // Silent failure — consolidation is a background optimization
  }
}
