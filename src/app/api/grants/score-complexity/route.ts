export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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

    // Batch grants in groups of 5 to reduce API calls
    const BATCH_SIZE = 3;
    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
      const batch = grants.slice(i, i + BATCH_SIZE);

      const systemPrompt = `You are a grant application complexity analyst. For each grant, assess how complex and time-consuming it would be to apply for.

Consider:
1. Application requirements — how many documents, forms, reports needed?
2. Eligibility verification — how hard is it to prove eligibility?
3. Reporting obligations — ongoing compliance burden if awarded?
4. Competition level — how selective is this grant typically?
5. Technical requirements — does it require specialist knowledge to apply?

Return ONLY valid JSON array, no markdown:
[{"id": "<grant_id>", "complexityScore": <integer 0-100>, "complexityLabel": "<Low | Medium | High | Very High>", "complexityNotes": "<2 sentence explanation>"}, ...]`;

      const userPrompt = batch.map(g => `ID: ${g.id}\nGrant: ${g.name}\nEligibility: ${g.eligibility ?? "Not specified"}\nHow to Apply: ${g.howToApply ?? "Not specified"}\nAmount: ${g.amount ?? "Not specified"}\nDuration: ${g.projectDuration ?? "Not specified"}\nGeographic Scope: ${g.geographicScope ?? "Not specified"}\nNotes: ${g.notes ?? "None"}`).join("\n\n---\n\n");

      try {
        const aiResult = await callOpenAIWithUsage({
          systemPrompt,
          userPrompt,
          model: MODEL_CONFIG.grantsAnalyse,
          maxTokens: 600,
          temperature: 0.2,
          jsonMode: true,
        });

        totalPrompt += aiResult.promptTokens;
        totalCompletion += aiResult.completionTokens;

        const parsed = JSON.parse(aiResult.content);
        const scores: { id: string; complexityScore: number; complexityLabel: string; complexityNotes: string }[] = Array.isArray(parsed) ? parsed : (parsed.results ?? []);

        for (const s of scores) {
          if (!s.id) continue;
          const complexityScore = typeof s.complexityScore === "number" ? Math.min(100, Math.max(0, Math.round(s.complexityScore))) : 50;
          const complexityLabel = ["Low", "Medium", "High", "Very High"].includes(s.complexityLabel) ? s.complexityLabel : "Medium";
          const complexityNotes = typeof s.complexityNotes === "string" ? s.complexityNotes : "";

          await db.from("Grant").update({
            complexityScore,
            complexityLabel,
            complexityNotes,
            updatedAt: new Date().toISOString(),
          }).eq("id", s.id);

          results.push({ id: s.id, complexityScore, complexityLabel, complexityNotes });
        }
      } catch {
        // Fallback: mark batch as medium on error
        for (const g of batch) {
          results.push({ id: g.id, complexityScore: 50, complexityLabel: "Medium", complexityNotes: "Could not assess complexity." });
        }
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
