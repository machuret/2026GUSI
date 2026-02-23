export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { logAiUsage } from "@/lib/aiUsage";
import { createContent, CATEGORIES } from "@/lib/content";
import { buildGenerationPrompt } from "@/lib/contentContext";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { stripMarkdown } from "@/lib/htmlUtils";
import { z } from "zod";

const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

const bulkSchema = z.object({
  companyId: z.string().min(1),
  category: z.enum(categoryKeys),
  topics: z.array(z.string().min(1).max(500, "Topic must be under 500 characters")).min(1).max(20),
  brief: z.object({
    audience: z.string().max(500).optional(),
    goal: z.string().max(500).optional(),
    cta: z.string().max(300).optional(),
    keywords: z.string().max(500).optional(),
    tone: z.number().min(0).max(4).optional(),
    length: z.number().min(0).max(4).optional(),
    platform: z.string().max(100).optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const rl = checkRateLimit(`generate-bulk:${authUser.id}`, RATE_LIMITS.generateBulk);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const data = bulkSchema.parse(body);

    const { data: company } = await db
      .from("Company")
      .select("*")
      .eq("id", data.companyId)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const catLabel = CATEGORIES.find((c) => c.key === data.category)?.label ?? data.category;
    const systemPrompt = await buildGenerationPrompt(company, data.companyId, data.category, data.brief);

    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate_bulk",
      `Bulk ${catLabel}: ${data.topics.length} topics`
    );

    // Generate all topics sequentially — each with a 30s timeout
    const results: { topic: string; id: string; output: string; error?: string }[] = [];
    const TOPIC_TIMEOUT_MS = 30_000;

    for (const topic of data.topics) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Topic timed out after 30s")), TOPIC_TIMEOUT_MS)
        );

        const generatePromise = callOpenAIWithUsage({
          systemPrompt,
          userPrompt: topic,
          model: MODEL_CONFIG.generateBulk,
          maxTokens: 2500,
          temperature: 0.65,
          jsonMode: false,
        });

        const aiResult = await Promise.race([generatePromise, timeoutPromise]);
        const output = stripMarkdown(aiResult.content);

        const saved = await createContent(data.category, {
          companyId: data.companyId,
          userId: appUser.id,
          prompt: topic,
          output,
        });

        logAiUsage({ model: MODEL_CONFIG.generateBulk, feature: "generate_bulk", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens, userId: authUser.id });
        results.push({ topic, id: saved.id, output });
      } catch (err) {
        results.push({ topic, id: "", output: "", error: err instanceof Error ? err.message : "Failed" });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      generated: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    });
  } catch (error) {
    return handleApiError(error, "Generate Bulk");
  }
}
