export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { logAiUsage } from "@/lib/aiUsage";
import { createContent, CATEGORIES } from "@/lib/content";
import { categoryKeys, briefSchema } from "@/lib/contentSchemas";
import { buildGenerationPrompt } from "@/lib/contentContext";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { stripMarkdown } from "@/lib/htmlUtils";
import { z } from "zod";

const abSchema = z.object({
  companyId: z.string().min(1),
  prompt: z.string().min(1).max(2000, "Prompt must be under 2000 characters"),
  category: z.enum(categoryKeys),
  brief: briefSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const rl = checkRateLimit(`generate-ab:${authUser.id}`, RATE_LIMITS.generateAB);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const data = abSchema.parse(body);

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

    // Generate 2 variants in parallel — use allSettled so one failure doesn't kill both
    const [resA, resB] = await Promise.allSettled([
      callOpenAIWithUsage({
        systemPrompt,
        userPrompt: data.prompt,
        model: MODEL_CONFIG.generateAB,
        maxTokens: 2500,
        temperature: 0.55,
        jsonMode: false,
      }),
      callOpenAIWithUsage({
        systemPrompt: systemPrompt + "\n\nIMPORTANT: Write a distinctly different version — different opening, different structure, different angle. Same brief, fresh approach.",
        userPrompt: data.prompt,
        model: MODEL_CONFIG.generateAB,
        maxTokens: 2500,
        temperature: 0.85,
        jsonMode: false,
      }),
    ]);

    if (resA.status === "rejected" && resB.status === "rejected") {
      return NextResponse.json({ error: "Both AI variants failed to generate" }, { status: 500 });
    }

    const outputA = resA.status === "fulfilled" ? stripMarkdown(resA.value.content) : "";
    const outputB = resB.status === "fulfilled" ? stripMarkdown(resB.value.content) : "";

    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate_ab",
      `A/B ${catLabel}: ${data.prompt.slice(0, 100)}`
    );

    // Save whichever variants succeeded
    const saveResults = await Promise.allSettled([
      outputA ? createContent(data.category, { companyId: data.companyId, userId: appUser.id, prompt: data.prompt, output: outputA }) : Promise.reject(new Error("skipped")),
      outputB ? createContent(data.category, { companyId: data.companyId, userId: appUser.id, prompt: data.prompt, output: outputB }) : Promise.reject(new Error("skipped")),
    ]);

    const variantA = saveResults[0].status === "fulfilled" ? { id: saveResults[0].value.id, output: outputA } : null;
    const variantB = saveResults[1].status === "fulfilled" ? { id: saveResults[1].value.id, output: outputB } : null;

    const totalPrompt     = (resA.status === "fulfilled" ? resA.value.promptTokens     : 0) + (resB.status === "fulfilled" ? resB.value.promptTokens     : 0);
    const totalCompletion = (resA.status === "fulfilled" ? resA.value.completionTokens : 0) + (resB.status === "fulfilled" ? resB.value.completionTokens : 0);
    logAiUsage({ model: MODEL_CONFIG.generateAB, feature: "generate_ab", promptTokens: totalPrompt, completionTokens: totalCompletion, userId: authUser.id });

    return NextResponse.json({
      success: true,
      variantA,
      variantB,
      category: data.category,
      partial: !variantA || !variantB,
    });
  } catch (error) {
    return handleApiError(error, "Generate A/B");
  }
}
