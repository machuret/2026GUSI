export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const bodySchema = z.object({
  grantIds: z.array(z.string()).min(1).max(20),
});

// POST /api/grants/score-complexity — batch score complexity for up to 20 grants
export async function POST(req: NextRequest) {
  try {
    const { response: authError, user: authUser } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { grantIds } = bodySchema.parse(body);

    const { data: grants, error } = await db
      .from("Grant")
      .select("id, name, eligibility, howToApply, amount, projectDuration, geographicScope, notes")
      .eq("companyId", DEMO_COMPANY_ID)
      .in("id", grantIds);

    if (error) throw error;
    if (!grants || grants.length === 0) {
      return NextResponse.json({ error: "No grants found" }, { status: 404 });
    }

    const results: { id: string; complexityScore: number; complexityLabel: string; complexityNotes: string }[] = [];
    let totalPrompt = 0;
    let totalCompletion = 0;

    for (const grant of grants) {
      const systemPrompt = `You are a grant application complexity analyst. Assess how complex and time-consuming this grant would be to apply for.

Consider:
1. Application requirements — how many documents, forms, reports needed?
2. Eligibility verification — how hard is it to prove eligibility?
3. Reporting obligations — ongoing compliance burden if awarded?
4. Competition level — how selective is this grant typically?
5. Technical requirements — does it require specialist knowledge to apply?

Return ONLY valid JSON, no markdown:
{
  "complexityScore": <integer 0-100>,
  "complexityLabel": "<one of: Low | Medium | High | Very High>",
  "complexityNotes": "<2 sentence plain-English explanation of why>"
}`;

      const userPrompt = `Grant: ${grant.name}
Eligibility: ${grant.eligibility ?? "Not specified"}
How to Apply: ${grant.howToApply ?? "Not specified"}
Amount: ${grant.amount ?? "Not specified"}
Duration: ${grant.projectDuration ?? "Not specified"}
Geographic Scope: ${grant.geographicScope ?? "Not specified"}
Notes: ${grant.notes ?? "None"}`;

      try {
        const aiResult = await callOpenAIWithUsage({
          systemPrompt,
          userPrompt,
          model: MODEL_CONFIG.grantsAnalyse,
          maxTokens: 300,
          temperature: 0.2,
          jsonMode: true,
        });

        totalPrompt += aiResult.promptTokens;
        totalCompletion += aiResult.completionTokens;

        const parsed = JSON.parse(aiResult.content);
        const complexityScore = typeof parsed.complexityScore === "number" ? Math.min(100, Math.max(0, parsed.complexityScore)) : 50;
        const complexityLabel = ["Low", "Medium", "High", "Very High"].includes(parsed.complexityLabel) ? parsed.complexityLabel : "Medium";
        const complexityNotes = typeof parsed.complexityNotes === "string" ? parsed.complexityNotes : "";

        // Persist to DB
        await db.from("Grant").update({
          complexityScore,
          complexityLabel,
          complexityNotes,
          updatedAt: new Date().toISOString(),
        }).eq("id", grant.id);

        results.push({ id: grant.id, complexityScore, complexityLabel, complexityNotes });
      } catch {
        results.push({ id: grant.id, complexityScore: 50, complexityLabel: "Medium", complexityNotes: "Could not assess complexity." });
      }
    }

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_complexity",
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      userId: authUser?.id,
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return handleApiError(error, "Score Complexity");
  }
}
