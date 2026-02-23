export const dynamic = 'force-dynamic'
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

const generateSchema = z.object({
  companyId: z.string().min(1),
  prompt: z.string().min(1).max(2000, "Prompt must be under 2000 characters"),
  category: z.enum(categoryKeys),
  extraFields: z.record(z.any()).optional(),
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

    const rl = checkRateLimit(`generate:${authUser.id}`, RATE_LIMITS.generate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const data = generateSchema.parse(body);

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

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt: data.prompt,
      model: MODEL_CONFIG.generate,
      maxTokens: 2500,
      temperature: 0.65,
      jsonMode: false,
    });
    const output = stripMarkdown(aiResult.content);

    // Get or create app user for tracking
    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate",
      `${catLabel}: ${data.prompt.slice(0, 100)}`
    );

    // Save to the correct category table
    const generated = await createContent(data.category, {
      companyId: data.companyId,
      userId: appUser.id,
      prompt: data.prompt,
      output,
      ...(data.extraFields || {}),
    });

    logAiUsage({ model: MODEL_CONFIG.generate, feature: "generate", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens, userId: authUser.id });

    return NextResponse.json({ success: true, generated, category: data.category });
  } catch (error) {
    return handleApiError(error, "Generate");
  }
}
